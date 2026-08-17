create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  item_date date not null,
  start_time time,
  title text not null check (char_length(trim(title)) between 1 and 200),
  location text check (location is null or char_length(trim(location)) <= 200),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index itinerary_items_trip_chronological_idx
  on public.itinerary_items (trip_id, item_date, start_time);

alter table public.itinerary_items enable row level security;

grant select, insert, update, delete on table public.itinerary_items to authenticated;
grant all on table public.itinerary_items to service_role;

create policy "Participants can view itinerary items"
on public.itinerary_items
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_participants participant
    where participant.trip_id = itinerary_items.trip_id
      and participant.user_id = (select auth.uid())
  )
);

create policy "Participants can create itinerary items"
on public.itinerary_items
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.trip_participants participant
    where participant.trip_id = itinerary_items.trip_id
      and participant.user_id = (select auth.uid())
  )
);

create policy "Participants can update itinerary items"
on public.itinerary_items
for update
to authenticated
using (
  exists (
    select 1
    from public.trip_participants participant
    where participant.trip_id = itinerary_items.trip_id
      and participant.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.trip_participants participant
    where participant.trip_id = itinerary_items.trip_id
      and participant.user_id = (select auth.uid())
  )
);

create policy "Participants can delete itinerary items"
on public.itinerary_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.trip_participants participant
    where participant.trip_id = itinerary_items.trip_id
      and participant.user_id = (select auth.uid())
  )
);
