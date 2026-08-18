create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 200),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  category text not null check (
    category in ('transport', 'lodging', 'food', 'activities', 'shopping', 'other')
  ),
  expense_date date not null,
  payer_id uuid not null references auth.users (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_expenses_trip_date_idx
  on public.trip_expenses (trip_id, expense_date desc);
create index trip_expenses_payer_id_idx on public.trip_expenses (payer_id);

alter table public.trip_expenses enable row level security;

grant select, insert, update, delete on table public.trip_expenses to authenticated;
grant all on table public.trip_expenses to service_role;

create policy "Participants can view trip expenses"
on public.trip_expenses
for select
to authenticated
using (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_expenses.trip_id
      and participant.user_id = (select auth.uid())
  )
);

create policy "Participants can create trip expenses"
on public.trip_expenses
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_expenses.trip_id
      and participant.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.trip_participants payer
    where payer.trip_id = trip_expenses.trip_id
      and payer.user_id = trip_expenses.payer_id
  )
);

create policy "Participants can update trip expenses"
on public.trip_expenses
for update
to authenticated
using (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_expenses.trip_id
      and participant.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_expenses.trip_id
      and participant.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.trip_participants payer
    where payer.trip_id = trip_expenses.trip_id
      and payer.user_id = trip_expenses.payer_id
  )
);

create policy "Participants can delete trip expenses"
on public.trip_expenses
for delete
to authenticated
using (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_expenses.trip_id
      and participant.user_id = (select auth.uid())
  )
);
