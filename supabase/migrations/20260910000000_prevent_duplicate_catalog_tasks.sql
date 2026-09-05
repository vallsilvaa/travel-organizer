-- Issue #171: a catalog template already applied to a trip (and still
-- active there) must not be applicable a second time. Identity is by
-- template_id, never by title (two distinct templates can share a title).
-- A partial unique index - rather than a plain column check - lets a
-- removed copy free the template back up for re-adding (the row is gone,
-- so the index no longer sees a conflict), while still catching duplicate
-- concurrent/racing applies at the database level, not just in the UI.
create unique index trip_tasks_trip_template_id_unique
  on public.trip_tasks (trip_id, template_id)
  where template_id is not null;
