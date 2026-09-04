-- Issue #149 remodels the organizer's reusable-task catalog:
-- - a third item_type, 'itinerary_item', so a reusable model can also
--   become a trip's itinerary entry (applied via itinerary_items, not
--   trip_tasks);
-- - continent becomes optional (the spec's field list is just "país");
-- - due_offset_days becomes optional-unless-preparation, and is
--   restricted to a fixed set of lead times instead of any 0-730 value.
--
-- Existing rows (including the organizer's own already-applied catalog)
-- must keep working: the item_type list only grows, continent only
-- relaxes from required to optional (NULL already satisfies the existing
-- length check, since a NULL operand makes a check constraint pass), and
-- the new due_offset_days value-set check is added NOT VALID so rows
-- seeded before this constraint existed (some using lead times outside
-- the new fixed set) are grandfathered in rather than rejected - only
-- new inserts/updates must conform going forward.
alter table public.prep_item_templates
  drop constraint prep_item_templates_item_type_check;
alter table public.prep_item_templates
  add constraint prep_item_templates_item_type_check check (
    item_type in ('preparation', 'document_request', 'itinerary_item')
  );

alter table public.prep_item_templates
  alter column continent drop not null;

alter table public.prep_item_templates
  alter column due_offset_days drop not null;
alter table public.prep_item_templates
  drop constraint prep_item_templates_due_offset_days_check;
alter table public.prep_item_templates
  add constraint prep_item_templates_due_offset_days_is_valid check (
    due_offset_days is null or due_offset_days in (1, 7, 30, 60, 90, 120, 180)
  ) not valid;
alter table public.prep_item_templates
  add constraint prep_item_templates_timeline_required_for_preparation check (
    item_type <> 'preparation' or due_offset_days is not null
  );

-- Mirror the same relaxation on the applied side: a governed trip_tasks
-- row (an applied preparation/document_request item) previously required
-- both continent and country. Templates can now omit continent, and
-- applying one must not fail just because of that - country (the only
-- field #149 actually calls required) is enough.
alter table public.trip_tasks
  drop constraint trip_tasks_governed_item_has_location;
alter table public.trip_tasks
  add constraint trip_tasks_governed_item_has_location check (
    classification is null or country is not null
  );
