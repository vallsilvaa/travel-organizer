-- Issue #171: distinguishes an expense that's actually been paid from one
-- that's only planned ("A pagar"), and separates a real/paid amount from
-- an optional estimate. Every existing row is a genuine past expense, so
-- it backfills as 'paid' by construction (the new column's default),
-- preserving today's totals/balances unchanged.
alter table public.trip_expenses
  add column payment_status text not null default 'paid' check (
    payment_status in ('paid', 'to_pay')
  ),
  add column estimated_amount numeric(14, 2) check (
    estimated_amount is null or estimated_amount > 0
  );

-- A "to_pay" expense may start as an estimate only - amount and payer
-- become required precisely when it's marked paid.
alter table public.trip_expenses
  alter column amount drop not null,
  alter column payer_id drop not null;

alter table public.trip_expenses
  drop constraint trip_expenses_amount_check;
alter table public.trip_expenses
  add constraint trip_expenses_amount_is_valid check (amount is null or amount > 0);

alter table public.trip_expenses
  add constraint trip_expenses_paid_requires_amount_and_payer check (
    payment_status <> 'paid' or (amount is not null and payer_id is not null)
  );
alter table public.trip_expenses
  add constraint trip_expenses_has_some_amount check (
    amount is not null or estimated_amount is not null
  );

grant update (payment_status, estimated_amount) on table public.trip_expenses to authenticated;

-- Extends the two write RPCs with two new trailing parameters. Postgres
-- does not let `create or replace function` change a function's parameter
-- list in place - it would silently create a second overload instead,
-- leaving old 8/9-arg call sites ambiguous between both signatures. The old
-- signatures must be dropped first so there is exactly one version of each
-- function, and every existing call site (which never passes the new
-- fields) keeps behaving exactly as a plain "paid" expense with no
-- estimate - only the shares invariant is relaxed to skip when amount
-- isn't known yet (a to_pay expense with only an estimate has nothing to
-- split).
drop function if exists public.create_expense_with_shares(uuid, text, numeric, text, text, date, uuid, jsonb);
drop function if exists public.update_expense_with_shares(uuid, uuid, text, numeric, text, text, date, uuid, jsonb);

create or replace function public.create_expense_with_shares(
  p_trip_id uuid,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_expense_date date,
  p_payer_id uuid,
  p_shares jsonb default '[]'::jsonb,
  p_payment_status text default 'paid',
  p_estimated_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_shares_total numeric(14, 2);
  v_invalid_share_count int;
begin
  if not private.is_trip_participant(p_trip_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  if private.is_trip_archived(p_trip_id) then
    raise exception 'trip_archived';
  end if;

  if p_payment_status = 'paid' and not private.is_trip_participant(p_trip_id, p_payer_id) then
    raise exception 'invalid_payer';
  end if;

  if p_amount is not null then
    select coalesce(sum((share ->> 'share_amount')::numeric(14, 2)), 0)
    into v_shares_total
    from jsonb_array_elements(p_shares) as share;

    if jsonb_array_length(p_shares) > 0 and v_shares_total <> p_amount then
      raise exception 'shares_do_not_match_total';
    end if;

    select count(*) into v_invalid_share_count
    from jsonb_array_elements(p_shares) as share
    where not private.is_trip_participant(p_trip_id, (share ->> 'user_id')::uuid);

    if v_invalid_share_count > 0 then
      raise exception 'invalid_participant';
    end if;
  end if;

  insert into public.trip_expenses (
    trip_id, description, amount, currency, category, expense_date, payer_id, created_by,
    payment_status, estimated_amount
  ) values (
    p_trip_id, p_description, p_amount, p_currency, p_category, p_expense_date, p_payer_id, auth.uid(),
    p_payment_status, p_estimated_amount
  )
  returning id into v_expense_id;

  if p_amount is not null then
    insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount)
    select v_expense_id, p_trip_id, (share ->> 'user_id')::uuid, (share ->> 'share_amount')::numeric(14, 2)
    from jsonb_array_elements(p_shares) as share
    where (share ->> 'share_amount')::numeric(14, 2) > 0;
  end if;

  return v_expense_id;
end;
$$;

revoke execute on function public.create_expense_with_shares(
  uuid, text, numeric, text, text, date, uuid, jsonb, text, numeric
) from public, anon;
grant execute on function public.create_expense_with_shares(
  uuid, text, numeric, text, text, date, uuid, jsonb, text, numeric
) to authenticated;

create or replace function public.update_expense_with_shares(
  p_expense_id uuid,
  p_trip_id uuid,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_expense_date date,
  p_payer_id uuid,
  p_shares jsonb default '[]'::jsonb,
  p_payment_status text default 'paid',
  p_estimated_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_id uuid;
  v_shares_total numeric(14, 2);
  v_invalid_share_count int;
begin
  if not private.is_trip_participant(p_trip_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  if private.is_trip_archived(p_trip_id) then
    raise exception 'trip_archived';
  end if;

  if p_payment_status = 'paid' and not private.is_trip_participant(p_trip_id, p_payer_id) then
    raise exception 'invalid_payer';
  end if;

  if p_amount is not null then
    select coalesce(sum((share ->> 'share_amount')::numeric(14, 2)), 0)
    into v_shares_total
    from jsonb_array_elements(p_shares) as share;

    if jsonb_array_length(p_shares) > 0 and v_shares_total <> p_amount then
      raise exception 'shares_do_not_match_total';
    end if;

    select count(*) into v_invalid_share_count
    from jsonb_array_elements(p_shares) as share
    where not private.is_trip_participant(p_trip_id, (share ->> 'user_id')::uuid);

    if v_invalid_share_count > 0 then
      raise exception 'invalid_participant';
    end if;
  end if;

  update public.trip_expenses
  set description = p_description,
      amount = p_amount,
      currency = p_currency,
      category = p_category,
      expense_date = p_expense_date,
      payer_id = p_payer_id,
      payment_status = p_payment_status,
      estimated_amount = p_estimated_amount,
      updated_at = now()
  where id = p_expense_id
    and trip_id = p_trip_id
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'expense_not_found';
  end if;

  delete from public.trip_expense_shares where expense_id = p_expense_id;

  if p_amount is not null then
    insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount)
    select p_expense_id, p_trip_id, (share ->> 'user_id')::uuid, (share ->> 'share_amount')::numeric(14, 2)
    from jsonb_array_elements(p_shares) as share
    where (share ->> 'share_amount')::numeric(14, 2) > 0;
  end if;
end;
$$;

revoke execute on function public.update_expense_with_shares(
  uuid, uuid, text, numeric, text, text, date, uuid, jsonb, text, numeric
) from public, anon;
grant execute on function public.update_expense_with_shares(
  uuid, uuid, text, numeric, text, text, date, uuid, jsonb, text, numeric
) to authenticated;

-- Only paid expenses (and their shares) count toward real totals/balances -
-- planned-but-unpaid amounts must not shift what anyone currently owes.
create or replace function public.get_trip_expense_balances(requested_trip_id uuid)
returns table (
  user_id uuid,
  display_name text,
  currency text,
  total_paid numeric(14, 2),
  total_owed numeric(14, 2),
  net_balance numeric(14, 2)
)
language sql
stable
security definer
set search_path = ''
as $$
  with paid as (
    select payer_id as user_id, currency, sum(amount) as total_paid
    from public.trip_expenses
    where trip_id = requested_trip_id
      and payment_status = 'paid'
    group by payer_id, currency
  ),
  owed as (
    select shares.user_id, expense.currency, sum(shares.share_amount) as total_owed
    from public.trip_expense_shares shares
    join public.trip_expenses expense on expense.id = shares.expense_id
    where shares.trip_id = requested_trip_id
      and expense.payment_status = 'paid'
    group by shares.user_id, expense.currency
  ),
  combined as (
    select
      coalesce(paid.user_id, owed.user_id) as user_id,
      coalesce(paid.currency, owed.currency) as currency,
      coalesce(paid.total_paid, 0) as total_paid,
      coalesce(owed.total_owed, 0) as total_owed
    from paid
    full outer join owed
      on paid.user_id = owed.user_id and paid.currency = owed.currency
  )
  select
    combined.user_id,
    profile.display_name,
    combined.currency,
    combined.total_paid,
    combined.total_owed,
    combined.total_paid - combined.total_owed as net_balance
  from combined
  join public.profiles profile on profile.id = combined.user_id;
$$;

-- Per-currency comparison of estimated vs. real spend, for the Despesas
-- summary. A "to_pay" row without a real amount yet only contributes its
-- estimate to to_pay_total; once paid, it moves into paid_total instead
-- (matching get_trip_expense_balances' payment_status filter).
create function public.get_trip_expense_summary(requested_trip_id uuid)
returns table (
  currency text,
  estimated_total numeric(14, 2),
  paid_total numeric(14, 2),
  to_pay_total numeric(14, 2)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_trip_participant(requested_trip_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    expense.currency,
    coalesce(sum(expense.estimated_amount), 0) as estimated_total,
    coalesce(sum(expense.amount) filter (where expense.payment_status = 'paid'), 0) as paid_total,
    coalesce(
      sum(coalesce(expense.amount, expense.estimated_amount, 0)) filter (where expense.payment_status = 'to_pay'),
      0
    ) as to_pay_total
  from public.trip_expenses expense
  where expense.trip_id = requested_trip_id
  group by expense.currency;
end;
$$;

revoke execute on function public.get_trip_expense_summary(uuid) from public, anon;
grant execute on function public.get_trip_expense_summary(uuid) to authenticated;
