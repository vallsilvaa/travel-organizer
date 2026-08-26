alter table public.trip_invitations
  drop constraint trip_invitations_role_check;
alter table public.trip_invitations
  add constraint trip_invitations_role_check check (role in ('traveler', 'organizer'));

drop policy "Trip creators can invite organizers" on public.trip_invitations;

create policy "Trip creators can invite participants"
on public.trip_invitations
for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and status = 'pending'
  and invited_user_id is null
  and lower(email) <> lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and exists (
    select 1
    from public.trips trip
    where trip.id = trip_invitations.trip_id
      and trip.created_by = (select auth.uid())
  )
);

drop trigger on_trip_invitation_responded on public.trip_invitations;
drop function public.add_accepted_organizer_to_trip();

create function public.add_accepted_participant_to_trip()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.trip_participants (trip_id, user_id, role)
    values (new.trip_id, new.invited_user_id, new.role)
    on conflict (trip_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_trip_invitation_responded
  after update of status on public.trip_invitations
  for each row execute procedure public.add_accepted_participant_to_trip();

revoke execute on function public.add_accepted_participant_to_trip()
  from public, anon, authenticated;

-- The creator can remove any participant (traveler or organizer), not just
-- organizers - both roles carry identical access, so removal should not
-- depend on which role was chosen at invite time.
drop policy "Trip creators can remove organizers" on public.trip_participants;

create policy "Trip creators can remove participants"
on public.trip_participants
for delete
to authenticated
using (
  user_id <> (
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
