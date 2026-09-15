-- Tracks "Lembrar" (remind) taps on a pending expense balance, so the
-- server action can rate-limit to one reminder per (trip, creditor,
-- debtor, currency) every 24h instead of allowing spam.
create table public.expense_balance_reminders (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  currency text not null,
  sent_at timestamptz not null default now()
);

create index expense_balance_reminders_lookup_idx
  on public.expense_balance_reminders (trip_id, from_user_id, to_user_id, currency, sent_at desc);

alter table public.expense_balance_reminders enable row level security;

grant select, insert on table public.expense_balance_reminders to authenticated;
grant all on table public.expense_balance_reminders to service_role;

-- Only the sender needs to read these rows, to check whether they already
-- reminded this same debtor recently before sending another one.
create policy "Senders can view their own expense reminders"
on public.expense_balance_reminders
for select
to authenticated
using (from_user_id = (select auth.uid()));

create policy "Participants can send an expense reminder to a co-participant"
on public.expense_balance_reminders
for insert
to authenticated
with check (
  from_user_id = (select auth.uid())
  and from_user_id <> to_user_id
  and (select private.is_trip_participant(trip_id, auth.uid()))
  and (select private.is_trip_participant(trip_id, to_user_id))
  and not (select private.is_trip_archived(trip_id))
);
