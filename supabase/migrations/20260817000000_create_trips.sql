create table public.trips (
  id uuid primary key default gen_random_uuid(),
  destination text not null check (char_length(trim(destination)) between 1 and 200),
  start_date date not null,
  end_date date,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_end_date_not_before_start_date
    check (end_date is null or end_date >= start_date)
);

create table public.trip_participants (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('traveler', 'organizer')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_participants_user_id_idx
  on public.trip_participants (user_id);

alter table public.trips enable row level security;
alter table public.trip_participants enable row level security;

grant select, insert on table public.trips to authenticated;
grant select on table public.trip_participants to authenticated;
grant all on table public.trips to service_role;
grant all on table public.trip_participants to service_role;

create policy "Participants can view their trips"
on public.trips
for select
to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1
    from public.trip_participants participant
    where participant.trip_id = trips.id
      and participant.user_id = (select auth.uid())
  )
);

create policy "Users can create their own trips"
on public.trips
for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "Users can view their own participation"
on public.trip_participants
for select
to authenticated
using (user_id = (select auth.uid()));

create function public.add_trip_creator_as_participant()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.trip_participants (trip_id, user_id, role)
  values (new.id, new.created_by, 'traveler');
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute procedure public.add_trip_creator_as_participant();
