-- Narrow the update grant to the columns users are actually meant to
-- change (display_name via the profile-editing UI). RLS already prevents
-- cross-user writes, but this closes off tampering with your own id/
-- created_at through the same channel, matching the column-scoped grants
-- used elsewhere (e.g. trips.archived_at, trip_tasks status fields).
revoke update on table public.profiles from authenticated;
grant update (display_name, task_reminders_enabled, updated_at)
  on table public.profiles to authenticated;
