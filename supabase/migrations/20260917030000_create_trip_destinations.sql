-- Remodeling the trip concept (#213): a trip can now have one or more
-- structured destinations (city or country, picked from the same search
-- mechanism the prep-item catalog already uses) instead of a single
-- free-text field. trips.destination is kept as-is (still free text) and
-- from now on is auto-derived from this table by the create/update trip
-- actions, so every existing reader of trip.destination (invitation
-- emails, page titles, cover alt text, delete confirmations, dashboard
-- cards, ...) keeps working unchanged.

create table public.trip_destinations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 200),
  city text check (city is null or char_length(trim(city)) between 1 and 200),
  -- Matches label's 200-char ceiling (not the 100-char cap used for
  -- prep-item country names) because the backfill below seeds this column
  -- straight from trips.destination, whose own check constraint already
  -- allows up to 200 chars.
  country text not null check (char_length(trim(country)) between 1 and 200),
  continent text check (
    continent is null
    or continent in ('africa', 'antarctica', 'asia', 'europe', 'north_america', 'oceania', 'south_america')
  ),
  granularity text not null check (granularity in ('city', 'country')),
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  -- A 'city' destination must actually carry a city name; a 'country'
  -- destination is country-only and must not.
  constraint trip_destinations_granularity_matches_city check (
    (granularity = 'city' and city is not null)
    or (granularity = 'country' and city is null)
  )
);

create index trip_destinations_trip_idx on public.trip_destinations (trip_id, position);

alter table public.trip_destinations enable row level security;

grant select, insert, update, delete on table public.trip_destinations to authenticated;
grant all on table public.trip_destinations to service_role;

create policy "Participants can view trip destinations"
on public.trip_destinations
for select
to authenticated
using (
  (select private.is_trip_participant(trip_destinations.trip_id, auth.uid()))
);

-- Insert/update/delete are organizer-only (same standing as editing the
-- trip's own title/dates), unlike most trip content tables which any
-- participant can write - destinations describe the trip itself, not
-- something a traveler contributes.
create policy "Organizers can add trip destinations"
on public.trip_destinations
for insert
to authenticated
with check (
  (select private.is_trip_organizer(trip_destinations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_destinations.trip_id))
);

create policy "Organizers can update trip destinations"
on public.trip_destinations
for update
to authenticated
using (
  (select private.is_trip_organizer(trip_destinations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_destinations.trip_id))
)
with check (
  (select private.is_trip_organizer(trip_destinations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_destinations.trip_id))
);

create policy "Organizers can delete trip destinations"
on public.trip_destinations
for delete
to authenticated
using (
  (select private.is_trip_organizer(trip_destinations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_destinations.trip_id))
);

-- Every trip created before this table existed only ever had its single
-- free-text destination - preserve that as each trip's first (and only)
-- destination row instead of leaving it destination-less.
insert into public.trip_destinations (trip_id, label, city, country, continent, granularity, position)
select id, destination, null, destination, null, 'country', 0
from public.trips;
