-- A read-only, unauthenticated "share link" per trip (#188), for someone
-- following along (e.g. family) without becoming a participant. The token
-- itself is the access control - long, random, and never guessable - so
-- the two lookup RPCs below are intentionally granted to `anon` as well as
-- `authenticated`, and are the ONLY public-facing surface: they return a
-- narrow, hand-picked set of columns (no financial data, no confirmation
-- codes, no participant emails, no private notes) rather than exposing
-- trips/itinerary_items to anon directly.
create table public.trip_share_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index trip_share_links_active_idx
  on public.trip_share_links (trip_id)
  where revoked_at is null;

alter table public.trip_share_links enable row level security;

grant select, insert on table public.trip_share_links to authenticated;
grant update (revoked_at) on table public.trip_share_links to authenticated;
grant all on table public.trip_share_links to service_role;

create policy "Organizers can view their trip's share links"
on public.trip_share_links
for select
to authenticated
using (
  exists (select 1 from public.trips where id = trip_share_links.trip_id and created_by = (select auth.uid()))
  or exists (
    select 1 from public.trip_participants
    where trip_id = trip_share_links.trip_id and user_id = (select auth.uid()) and role = 'organizer'
  )
);

create policy "Organizers can create a share link for their trip"
on public.trip_share_links
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    exists (select 1 from public.trips where id = trip_share_links.trip_id and created_by = (select auth.uid()))
    or exists (
      select 1 from public.trip_participants
      where trip_id = trip_share_links.trip_id and user_id = (select auth.uid()) and role = 'organizer'
    )
  )
  and not (select private.is_trip_archived(trip_share_links.trip_id))
);

create policy "Organizers can revoke their trip's share link"
on public.trip_share_links
for update
to authenticated
using (
  exists (select 1 from public.trips where id = trip_share_links.trip_id and created_by = (select auth.uid()))
  or exists (
    select 1 from public.trip_participants
    where trip_id = trip_share_links.trip_id and user_id = (select auth.uid()) and role = 'organizer'
  )
)
with check (revoked_at is not null);

-- Trip summary for the public share page - deliberately excludes anything
-- sensitive (no destination_guide internals beyond content/source are
-- fine to show, but no created_by, no participant list here).
create function public.get_trip_by_share_token(p_token text)
returns table (
  trip_id uuid,
  destination text,
  start_date date,
  end_date date,
  timezone text,
  cover_image_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.destination, t.start_date, t.end_date, t.timezone, t.cover_image_path
  from public.trip_share_links l
  join public.trips t on t.id = l.trip_id
  where l.token = p_token and l.revoked_at is null;
$$;

revoke execute on function public.get_trip_by_share_token(text) from public;
grant execute on function public.get_trip_by_share_token(text) to anon, authenticated;

-- Itinerary skeleton only - no notes (may contain private detail) and no
-- linked reservation/task ids (those tables carry confirmation codes and
-- financial data and have no share-token access path of their own).
create function public.get_trip_itinerary_by_share_token(p_token text)
returns table (
  id uuid,
  item_date date,
  start_time time,
  title text,
  location text,
  city text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.item_date, i.start_time, i.title, i.location, i.city
  from public.trip_share_links l
  join public.itinerary_items i on i.trip_id = l.trip_id
  where l.token = p_token and l.revoked_at is null
  order by i.item_date, i.start_time nulls last;
$$;

revoke execute on function public.get_trip_itinerary_by_share_token(text) from public;
grant execute on function public.get_trip_itinerary_by_share_token(text) to anon, authenticated;
