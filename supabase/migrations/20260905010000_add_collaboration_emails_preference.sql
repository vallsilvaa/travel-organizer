-- Separate opt-out preference for the new organizer<->traveler change-alert
-- emails (#142/#144), distinct from task_reminders_enabled which only
-- governs the upcoming-deadline reminder (#10). Defaults to enabled to
-- match the existing reminders toggle's opt-out UX.
alter table public.profiles
  add column collaboration_emails_enabled boolean not null default true;

revoke update on table public.profiles from authenticated;
grant update (display_name, task_reminders_enabled, collaboration_emails_enabled, updated_at)
  on table public.profiles to authenticated;
