alter table public.trip_reservations
  add column itinerary_item_id uuid references public.itinerary_items (id) on delete set null;

create index trip_reservations_itinerary_item_id_idx
  on public.trip_reservations (itinerary_item_id) where itinerary_item_id is not null;

-- Same "does the referenced row actually belong to this trip" check already
-- used for item_comments' itinerary_item_id/task_id (see
-- 20260820000000_harden_authorization_and_rls.sql) - a plain FK can't
-- express cross-column trip scoping, so it goes in the RLS check instead.
drop policy "Participants can create reservations" on public.trip_reservations;
create policy "Participants can create reservations"
on public.trip_reservations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(trip_reservations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_reservations.trip_id))
  and (
    itinerary_item_id is null
    or exists (
      select 1
      from public.itinerary_items item
      where item.id = trip_reservations.itinerary_item_id
        and item.trip_id = trip_reservations.trip_id
    )
  )
);

drop policy "Participants can update reservations" on public.trip_reservations;
create policy "Participants can update reservations"
on public.trip_reservations
for update
to authenticated
using ((select private.is_trip_participant(trip_reservations.trip_id, auth.uid())))
with check (
  (select private.is_trip_participant(trip_reservations.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_reservations.trip_id))
  and (
    itinerary_item_id is null
    or exists (
      select 1
      from public.itinerary_items item
      where item.id = trip_reservations.itinerary_item_id
        and item.trip_id = trip_reservations.trip_id
    )
  )
);
