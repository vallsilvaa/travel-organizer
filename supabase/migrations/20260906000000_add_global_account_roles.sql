-- Global, account-level capabilities (issue #150) - distinct from
-- trip_participants.role, which only describes a person's standing on one
-- specific trip. These drive the post-login redirect (traveler-only ->
-- /dashboard, organizer-only -> /organizer, both -> the mode selector) and
-- gate direct access to /organizer.
alter table public.profiles
  add column is_traveler boolean not null default true,
  add column is_organizer boolean not null default false;

-- Preserve every existing user's current access: everyone keeps the
-- traveler/dashboard experience they already have (default true above
-- covers this for both existing and future rows), and anyone who has
-- already acted as an organizer on at least one trip - created it, or
-- been given the organizer role on it - is backfilled to is_organizer so
-- they don't lose access to /organizer once it becomes gated.
update public.profiles profile
set is_organizer = true
where exists (
  select 1 from public.trips trip
  where trip.created_by = profile.id
)
or exists (
  select 1 from public.trip_participants participant
  where participant.user_id = profile.id
    and participant.role = 'organizer'
);

-- is_organizer is granted server-side the moment a user creates their
-- first trip (see createTrip in src/features/trips/actions.ts) - the
-- Server Action decides the value, not client input, so this grant only
-- enables that trusted write path, the same way task_reminders_enabled
-- and collaboration_emails_enabled are already self-editable.
-- is_traveler has no write path yet - only ever set by this migration's
-- default/backfill - so it is deliberately left out of the grant.
revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  task_reminders_enabled,
  collaboration_emails_enabled,
  is_organizer,
  updated_at
) on table public.profiles to authenticated;
