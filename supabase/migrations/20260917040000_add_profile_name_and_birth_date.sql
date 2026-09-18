-- Dashboard redesign (#215): the profile edit form is splitting into
-- first_name/last_name/birth_date fields instead of one free-text
-- display_name. display_name is kept as the single source of truth every
-- other feature already reads (participants lists, expense/task forms,
-- notifications, invitations, cron jobs, the trip detail page - roughly 15
-- call sites) - it becomes *derived* from first_name + last_name and is
-- recomputed by the updateProfile server action whenever those change, so
-- none of those existing readers need to change.
alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column birth_date date;

-- Best-effort backfill from the existing single display_name field: split
-- on the first space, everything after it becomes last_name. Rows with a
-- single-word display_name get first_name only (last_name stays null).
update public.profiles
set
  first_name = split_part(display_name, ' ', 1),
  last_name = nullif(trim(substring(display_name from position(' ' in display_name) + 1)), '')
where position(' ' in display_name) > 0;

update public.profiles
set first_name = display_name
where first_name is null;

alter table public.profiles
  add constraint profiles_first_name_length check (char_length(first_name) between 1 and 100),
  add constraint profiles_last_name_length check (last_name is null or char_length(last_name) between 1 and 100);

revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  first_name,
  last_name,
  birth_date,
  task_reminders_enabled,
  collaboration_emails_enabled,
  is_organizer,
  updated_at
) on table public.profiles to authenticated;
