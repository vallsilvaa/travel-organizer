create table public.trip_reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  reservation_type text not null check (reservation_type in ('flight', 'lodging', 'transport')),
  title text not null check (char_length(trim(title)) between 1 and 200),
  provider text check (provider is null or char_length(trim(provider)) <= 200),
  confirmation_code text check (confirmation_code is null or char_length(trim(confirmation_code)) <= 100),
  start_date date not null,
  start_time time,
  end_date date,
  end_time time,
  location text check (location is null or char_length(trim(location)) <= 200),
  destination_location text check (destination_location is null or char_length(trim(destination_location)) <= 200),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_reservations_end_not_before_start check (end_date is null or end_date >= start_date)
);

create index trip_reservations_trip_chronological_idx
  on public.trip_reservations (trip_id, start_date, start_time);

alter table public.trip_reservations enable row level security;

grant select, insert, update, delete on table public.trip_reservations to authenticated;
grant all on table public.trip_reservations to service_role;

create policy "Participants can view reservations"
on public.trip_reservations
for select
to authenticated
using (
  (select private.is_trip_participant(trip_reservations.trip_id, auth.uid()))
);

create policy "Participants can create reservations"
on public.trip_reservations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(trip_reservations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_reservations.trip_id))
);

create policy "Participants can update reservations"
on public.trip_reservations
for update
to authenticated
using ((select private.is_trip_participant(trip_reservations.trip_id, auth.uid())))
with check (
  (select private.is_trip_participant(trip_reservations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_reservations.trip_id))
);

create policy "Participants can delete reservations"
on public.trip_reservations
for delete
to authenticated
using (
  (select private.is_trip_participant(trip_reservations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_reservations.trip_id))
);

alter publication supabase_realtime add table public.trip_reservations;
