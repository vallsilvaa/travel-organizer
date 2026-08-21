alter table public.trip_invitations
  add column expires_at timestamptz not null default (now() + interval '7 days');

alter table public.trip_invitations
  drop constraint trip_invitations_status_check;
alter table public.trip_invitations
  add constraint trip_invitations_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled'));

alter table public.trip_invitations
  drop constraint invitation_response_is_complete;
alter table public.trip_invitations
  add constraint invitation_response_is_complete
  check (
    (status = 'pending' and invited_user_id is null and responded_at is null)
    or
    (status in ('accepted', 'declined') and invited_user_id is not null and responded_at is not null)
    or
    (status = 'cancelled' and invited_user_id is null and responded_at is not null)
  );

grant update (expires_at) on table public.trip_invitations to authenticated;

drop policy "Invitees can respond once" on public.trip_invitations;
create policy "Invitees can respond once"
on public.trip_invitations
for update
to authenticated
using (
  status = 'pending'
  and now() < expires_at
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
)
with check (
  status in ('accepted', 'declined')
  and invited_user_id = (select auth.uid())
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy "Trip creators can cancel invitations"
on public.trip_invitations
for update
to authenticated
using (
  status = 'pending'
  and exists (
    select 1
    from public.trips trip
    where trip.id = trip_invitations.trip_id
      and trip.created_by = (select auth.uid())
  )
)
with check (
  status = 'cancelled'
  and invited_user_id is null
  and responded_at is not null
  and exists (
    select 1
    from public.trips trip
    where trip.id = trip_invitations.trip_id
      and trip.created_by = (select auth.uid())
  )
);

create policy "Trip creators can resend invitations"
on public.trip_invitations
for update
to authenticated
using (
  status = 'pending'
  and exists (
    select 1
    from public.trips trip
    where trip.id = trip_invitations.trip_id
      and trip.created_by = (select auth.uid())
  )
)
with check (
  status = 'pending'
  and exists (
    select 1
    from public.trips trip
    where trip.id = trip_invitations.trip_id
      and trip.created_by = (select auth.uid())
  )
);
