-- #229 (Roteiro v2, R02): itinerary_items gains an explicit end time,
-- an approximate distance, and a "needs review" flag; prep_item_templates
-- gains an address for itinerary_item templates. itinerary_items already
-- had table update revoked in favor of per-column grants (see
-- 20260820000000_harden_authorization_and_rls.sql), so every new writable
-- column needs its own grant; prep_item_templates never had that revoke
-- (created after it, in 20260904000000_create_prep_item_templates.sql) and
-- still has a table-level update grant, so `location` needs none.
alter table public.itinerary_items
  add column end_time time,
  add column approx_distance text check (
    approx_distance is null or char_length(trim(approx_distance)) <= 100
  ),
  add column needs_review boolean not null default false;

alter table public.itinerary_items
  add constraint itinerary_items_end_time_requires_start_time check (
    end_time is null or start_time is not null
  );

grant update (end_time, approx_distance, needs_review)
  on table public.itinerary_items to authenticated;

alter table public.prep_item_templates
  add column location text check (
    location is null or char_length(trim(location)) <= 200
  );

-- D3 (#229): the spec wants the same reusable itinerary template applied
-- across multiple days of the same trip, so the old per-trip block
-- (itinerary_items_trip_template_id_unique, added in
-- 20260919000000_itinerary_item_template_link.sql) must go. Duplicate
-- *templates* in the personal catalog are still worth preventing, so a
-- new partial unique index replaces it at the template level instead:
-- an owner can't save two itinerary_item templates that are the same
-- trimmed/case-folded title + address. trim/lower matches how the rest
-- of this schema normalizes free text before comparing it (see the
-- title/location check constraints above), and coalesce(..., '') treats
-- "no address" as its own single value so two addressless templates with
-- the same title still collide.
drop index if exists public.itinerary_items_trip_template_id_unique;

create unique index prep_item_templates_itinerary_title_location_unique
  on public.prep_item_templates (
    owner_id,
    lower(trim(title)),
    coalesce(lower(trim(location)), '')
  )
  where item_type = 'itinerary_item';

-- D2 (#229): itinerary items/templates still carry title and action as
-- separate columns (#208/#222), but the new spec shows a single unified
-- title ("Check-in Hotel Lutetia") and the app stops writing `action`
-- going forward (R03). This is the one-time backfill for existing rows;
-- `action` itself is left in place, only ever read from now on. Only rows
-- whose title doesn't already start with their own action are touched -
-- re-running this (or a title already authored in the new unified shape)
-- must be a no-op, not double-prepend the action.
update public.itinerary_items
set title = trim(action) || ' ' || title
where action is not null
  and char_length(trim(action)) > 0
  and title not ilike trim(action) || '%';

update public.prep_item_templates
set title = trim(action) || ' ' || title
where item_type = 'itinerary_item'
  and action is not null
  and char_length(trim(action)) > 0
  and title not ilike trim(action) || '%';
