-- Issue #171: reservations can record what was actually paid (amount,
-- currency, payer) and keep a single linked trip_expenses row in sync -
-- mirrors the trip_tasks <-> trip_expenses pattern from #143, but for
-- reservations instead of preparation items.
alter table public.trip_reservations
  add column paid_amount numeric(14, 2) check (paid_amount is null or paid_amount > 0),
  add column currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  add column payer_id uuid references auth.users (id) on delete set null,
  add column expense_id uuid references public.trip_expenses (id) on delete set null;

alter table public.trip_reservations
  add constraint trip_reservations_paid_fields_are_consistent check (
    (paid_amount is null and currency is null and payer_id is null)
    or (paid_amount is not null and currency is not null and payer_id is not null)
  );

create index trip_reservations_expense_id_idx
  on public.trip_reservations (expense_id) where expense_id is not null;

revoke update on table public.trip_reservations from authenticated;
grant update (
  reservation_type, title, provider, confirmation_code, start_date, start_time,
  end_date, end_time, location, destination_location, notes, itinerary_item_id,
  updated_at, paid_amount, currency, payer_id
) on table public.trip_reservations to authenticated;

-- Not directly writable: only sync_reservation_expense (below) may stamp
-- this, the same way trip_tasks.expense_id is RPC-only.
revoke update (expense_id) on table public.trip_reservations from authenticated;

-- Maps a reservation onto the same expense categories already used
-- elsewhere; anything not flight/lodging collapses to 'transport' or
-- 'other' just like complete_prep_item's category mapping does.
create function private.reservation_expense_category(p_reservation_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reservation_type
    when 'lodging' then 'lodging'
    when 'flight' then 'transport'
    when 'transport' then 'transport'
    else 'other'
  end;
$$;

-- Keeps a reservation's paid_amount/currency/payer in sync with exactly
-- one trip_expenses row (+ single full-amount share), atomically. Called
-- by the reservation actions right after insert/update; never called
-- directly by the client, so the same trip-membership/archived guards
-- create_expense_with_shares already enforces are re-checked here too.
create function public.sync_reservation_expense(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.trip_reservations%rowtype;
  v_expense_id uuid;
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

  if not private.is_trip_participant(v_reservation.trip_id, v_reservation.payer_id) then
    raise exception 'invalid_payer';
  end if;

  if v_reservation.expense_id is null then
    insert into public.trip_expenses (
      trip_id, description, amount, currency, category, expense_date, payer_id, created_by
    ) values (
      v_reservation.trip_id, v_reservation.title, v_reservation.paid_amount, v_reservation.currency,
      private.reservation_expense_category(v_reservation.reservation_type), v_reservation.start_date,
      v_reservation.payer_id, auth.uid()
    )
    returning id into v_expense_id;

    insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount)
    values (v_expense_id, v_reservation.trip_id, v_reservation.payer_id, v_reservation.paid_amount);

    update public.trip_reservations set expense_id = v_expense_id where id = p_reservation_id;
  else
    update public.trip_expenses
    set description = v_reservation.title,
        amount = v_reservation.paid_amount,
        currency = v_reservation.currency,
        category = private.reservation_expense_category(v_reservation.reservation_type),
        expense_date = v_reservation.start_date,
        payer_id = v_reservation.payer_id,
        payment_status = 'paid',
        updated_at = now()
    where id = v_reservation.expense_id;

    delete from public.trip_expense_shares where expense_id = v_reservation.expense_id;
    insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount)
    values (v_reservation.expense_id, v_reservation.trip_id, v_reservation.payer_id, v_reservation.paid_amount);
  end if;
end;
$$;

revoke execute on function public.sync_reservation_expense(uuid) from public, anon;
grant execute on function public.sync_reservation_expense(uuid) to authenticated;

-- Hard-deleting a reservation must not leave its auto-generated expense
-- behind - same AFTER-trigger shape (and the same reason: avoids the "tuple
-- already modified" conflict with the FK's own ON DELETE SET NULL) as
-- trip_tasks_delete_linked_expense.
create function private.delete_linked_expense_after_reservation_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.expense_id is not null then
    delete from public.trip_expenses where id = old.expense_id;
  end if;
  return old;
end;
$$;

create trigger trip_reservations_delete_linked_expense
after delete on public.trip_reservations
for each row
execute function private.delete_linked_expense_after_reservation_delete();
