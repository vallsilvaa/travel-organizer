-- #205: a reservation's cost can now be "a pagar" (nobody has paid yet)
-- and split equally among several responsible people, instead of always
-- being an already-paid amount with exactly one payer.

alter table public.trip_reservations
  add column payment_status text check (payment_status is null or payment_status in ('paid', 'to_pay'));

-- Every existing reservation with a paid_amount was recorded under the old
-- single-payer model, which only ever represented an already-paid cost.
update public.trip_reservations
set payment_status = 'paid'
where paid_amount is not null;

-- payer_id (a single FK) can't represent more than one responsible person.
-- Who's responsible now lives only on the linked expense's shares
-- (trip_expense_shares, via expense_id) - the reservation itself no longer
-- needs to duplicate that list.
alter table public.trip_reservations
  drop constraint trip_reservations_paid_fields_are_consistent;

alter table public.trip_reservations
  drop column payer_id;

alter table public.trip_reservations
  add constraint trip_reservations_paid_fields_are_consistent check (
    (paid_amount is null and currency is null and payment_status is null)
    or (paid_amount is not null and currency is not null and payment_status is not null)
  );

revoke update on table public.trip_reservations from authenticated;
grant update (
  reservation_type, title, provider, confirmation_code, start_date, start_time,
  end_date, end_time, location, destination_location, notes, itinerary_item_id,
  updated_at, paid_amount, currency, payment_status
) on table public.trip_reservations to authenticated;

-- Not directly writable: only sync_reservation_expense (below) may stamp
-- this, same as before.
revoke update (expense_id) on table public.trip_reservations from authenticated;

-- The parameter list is changing (adding p_responsible_ids), so the old
-- single-arg version must be dropped first - `create or replace` can't
-- change a function's signature in place, it would silently create a
-- second overload and leave every existing call site ambiguous.
drop function if exists public.sync_reservation_expense(uuid);

-- Keeps a reservation's paid_amount/currency/payment_status in sync with
-- exactly one trip_expenses row and its shares, atomically. p_responsible_ids
-- is the equal-split list: when payment_status is 'paid', the first entry
-- is recorded as the expense's payer (whoever fronted the money) and every
-- entry (including the payer) gets an equal share, so co-responsible people
-- owe their part back - the same model a manually-split plain expense
-- already uses. When 'to_pay', there is no payer yet (payer_id stays null),
-- matching how a to_pay plain expense already behaves: excluded from
-- get_trip_expense_balances until it's marked paid.
create function public.sync_reservation_expense(
  p_reservation_id uuid,
  p_responsible_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.trip_reservations%rowtype;
  v_expense_id uuid;
  v_payer_id uuid;
  v_responsible_ids uuid[];
  v_responsible_count int;
  v_amount_cents bigint;
  v_base_cents bigint;
  v_remainder_cents bigint;
  v_responsible_id uuid;
  v_index int := 0;
  v_share_cents bigint;
begin
  select * into v_reservation
  from public.trip_reservations
  where id = p_reservation_id;

  if not found then
    raise exception 'reservation_not_found';
  end if;

  if not private.is_trip_participant(v_reservation.trip_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  if private.is_trip_archived(v_reservation.trip_id) then
    raise exception 'trip_archived';
  end if;

  if v_reservation.paid_amount is null then
    if v_reservation.expense_id is not null then
      delete from public.trip_expenses where id = v_reservation.expense_id;
      update public.trip_reservations set expense_id = null where id = p_reservation_id;
    end if;
    return;
  end if;

  select array_agg(distinct responsible_id) into v_responsible_ids
  from unnest(p_responsible_ids) as responsible_id;
  v_responsible_count := coalesce(array_length(v_responsible_ids, 1), 0);

  if v_responsible_count = 0 then
    raise exception 'responsible_required';
  end if;

  if exists (
    select 1 from unnest(v_responsible_ids) as responsible_id
    where not private.is_trip_participant(v_reservation.trip_id, responsible_id)
  ) then
    raise exception 'invalid_responsible';
  end if;

  v_payer_id := case when v_reservation.payment_status = 'paid' then v_responsible_ids[1] else null end;

  if v_reservation.expense_id is null then
    insert into public.trip_expenses (
      trip_id, description, amount, currency, category, expense_date, payer_id, created_by, payment_status
    ) values (
      v_reservation.trip_id, v_reservation.title, v_reservation.paid_amount, v_reservation.currency,
      private.reservation_expense_category(v_reservation.reservation_type), v_reservation.start_date,
      v_payer_id, auth.uid(), v_reservation.payment_status
    )
    returning id into v_expense_id;

    update public.trip_reservations set expense_id = v_expense_id where id = p_reservation_id;
  else
    v_expense_id := v_reservation.expense_id;

    update public.trip_expenses
    set description = v_reservation.title,
        amount = v_reservation.paid_amount,
        currency = v_reservation.currency,
        category = private.reservation_expense_category(v_reservation.reservation_type),
        expense_date = v_reservation.start_date,
        payer_id = v_payer_id,
        payment_status = v_reservation.payment_status,
        updated_at = now()
    where id = v_expense_id;

    delete from public.trip_expense_shares where expense_id = v_expense_id;
  end if;

  -- Equal split, any leftover cent handed to the first entries - same
  -- rounding rule as computeEqualShares in features/expenses/validation.ts.
  v_amount_cents := round(v_reservation.paid_amount * 100)::bigint;
  v_base_cents := v_amount_cents / v_responsible_count;
  v_remainder_cents := v_amount_cents - v_base_cents * v_responsible_count;

  foreach v_responsible_id in array v_responsible_ids loop
    v_share_cents := v_base_cents + (case when v_index < v_remainder_cents then 1 else 0 end);
    insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount)
    values (v_expense_id, v_reservation.trip_id, v_responsible_id, (v_share_cents / 100.0)::numeric(14, 2));
    v_index := v_index + 1;
  end loop;
end;
$$;

revoke execute on function public.sync_reservation_expense(uuid, uuid[]) from public, anon;
grant execute on function public.sync_reservation_expense(uuid, uuid[]) to authenticated;
