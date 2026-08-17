create table public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  trip_destination text not null check (
    char_length(trim(trip_destination)) between 1 and 200
  ),
  email text not null check (
    email = lower(email)
    and char_length(email) <= 320
    and email like '%_@_%._%'
  ),
  role text not null default 'organizer' check (role = 'organizer'),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined')
  ),
  invited_by uuid not null references auth.users (id) on delete cascade,
  invited_user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint invitation_response_is_complete check (
    (status = 'pending' and invited_user_id is null and responded_at is null)
    or
    (status in ('accepted', 'declined') and invited_user_id is not null and responded_at is not null)
  )
);

create unique index one_pending_invitation_per_trip_and_email
  on public.trip_invitations (trip_id, lower(email))
  where status = 'pending';

create index trip_invitations_email_idx
  on public.trip_invitations (lower(email));

alter table public.trip_invitations enable row level security;

grant select, insert on table public.trip_invitations to authenticated;
grant update (status, responded_at, invited_user_id)
  on table public.trip_invitations to authenticated;
grant all on table public.trip_invitations to service_role;

create policy "Trip creators can view invitations"
on public.trip_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.trips trip
    where trip.id = trip_invitations.trip_id
      and trip.created_by = (select auth.uid())
  )
);

create policy "Invitees can view their invitations"
on public.trip_invitations
for select
to authenticated
using (
  lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy "Trip creators can invite organizers"
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

create policy "Invitees can respond once"
on public.trip_invitations
for update
to authenticated
using (
  status = 'pending'
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
)
with check (
  status in ('accepted', 'declined')
  and invited_user_id = (select auth.uid())
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create function public.add_accepted_organizer_to_trip()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.trip_participants (trip_id, user_id, role)
    values (new.trip_id, new.invited_user_id, 'organizer')
    on conflict (trip_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_trip_invitation_responded
  after update of status on public.trip_invitations
  for each row execute procedure public.add_accepted_organizer_to_trip();
