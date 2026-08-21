grant delete on table public.trip_participants to authenticated;

create policy "Trip creators can remove organizers"
on public.trip_participants
for delete
to authenticated
using (
  role = 'organizer'
  and user_id <> (
    select trip.created_by
    from public.trips trip
    where trip.id = trip_participants.trip_id
  )
  and exists (
    select 1
    from public.trips trip
    where trip.id = trip_participants.trip_id
      and trip.created_by = (select auth.uid())
  )
);
