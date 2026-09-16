-- #210: track the reservation created when converting a completed prep
-- task, mirroring the existing itinerary_item_id link/grant/RLS shape
-- exactly (same-trip check instead of an RPC-only column, since the write
-- already only ever happens server-side as part of a single authorized
-- request - see convertPrepTaskOnCompletion).
alter table public.trip_tasks
  add column reservation_id uuid references public.trip_reservations (id) on delete set null;

create index trip_tasks_reservation_id_idx
  on public.trip_tasks (reservation_id)
  where reservation_id is not null;

grant update (reservation_id) on table public.trip_tasks to authenticated;

drop policy "Participants can create trip tasks" on public.trip_tasks;
create policy "Participants can create trip tasks"
on public.trip_tasks
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_tasks.trip_id))
  and (
    owner_id is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.owner_id))
  )
  and (
    completed_by is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.completed_by))
  )
  and (
    classification is null
    or (select private.is_trip_organizer(trip_tasks.trip_id, auth.uid()))
  )
  and (
    itinerary_item_id is null
    or exists (
      select 1
      from public.itinerary_items item
      where item.id = trip_tasks.itinerary_item_id
        and item.trip_id = trip_tasks.trip_id
    )
  )
  and (
    reservation_id is null
    or exists (
      select 1
      from public.trip_reservations reservation
      where reservation.id = trip_tasks.reservation_id
        and reservation.trip_id = trip_tasks.trip_id
    )
  )
);

drop policy "Participants can update trip tasks" on public.trip_tasks;
create policy "Participants can update trip tasks"
on public.trip_tasks
for update
to authenticated
using ((select private.is_trip_participant(trip_tasks.trip_id, auth.uid())))
with check (
  (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_tasks.trip_id))
  and (
    owner_id is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.owner_id))
  )
  and (
    completed_by is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.completed_by))
  )
  and (
    classification is null
    or (select private.is_trip_organizer(trip_tasks.trip_id, auth.uid()))
  )
  and (
    itinerary_item_id is null
    or exists (
      select 1
      from public.itinerary_items item
      where item.id = trip_tasks.itinerary_item_id
        and item.trip_id = trip_tasks.trip_id
    )
  )
  and (
    reservation_id is null
    or exists (
      select 1
      from public.trip_reservations reservation
      where reservation.id = trip_tasks.reservation_id
        and reservation.trip_id = trip_tasks.trip_id
    )
  )
);
