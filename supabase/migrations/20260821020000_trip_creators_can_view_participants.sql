-- PostgreSQL requires a row to satisfy a SELECT policy before UPDATE/DELETE
-- can affect it, even when a matching UPDATE/DELETE policy exists. Without
-- this, "Trip creators can remove organizers" (see
-- 20260821000000_manage_trip_participants.sql) can never actually delete
-- another participant's row, because the only SELECT policy on
-- trip_participants is "Users can view their own participation".
create policy "Trip creators can view all participants"
on public.trip_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.trips trip
    where trip.id = trip_participants.trip_id
      and trip.created_by = (select auth.uid())
  )
);
