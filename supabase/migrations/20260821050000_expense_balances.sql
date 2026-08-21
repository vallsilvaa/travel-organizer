-- Aggregates directly from trip_expenses/trip_expense_shares/profiles rather
-- than trip_participants, so a participant removed from the trip (see
-- 20260821000000_manage_trip_participants.sql) still shows up correctly in
-- balances for expenses they paid or owed a share of before being removed.
create function public.get_trip_expense_balances(requested_trip_id uuid)
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
    group by payer_id, currency
  ),
  owed as (
    select shares.user_id, expense.currency, sum(shares.share_amount) as total_owed
    from public.trip_expense_shares shares
    join public.trip_expenses expense on expense.id = shares.expense_id
    where shares.trip_id = requested_trip_id
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
  join public.profiles profile on profile.id = combined.user_id
  where private.is_trip_participant(requested_trip_id, auth.uid())
  order by combined.currency, profile.display_name;
$$;

revoke execute on function public.get_trip_expense_balances(uuid)
  from public, anon;
grant execute on function public.get_trip_expense_balances(uuid)
  to authenticated;
