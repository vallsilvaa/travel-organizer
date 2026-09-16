-- #206: allow a custom lead time (any whole number of days, 0-730) on a
-- preparation template, not just the 7 quick-pick presets. Reverts the
-- exact-value-set constraint added in 20260907000000_remodel_prep_item_catalog.sql
-- back to a plain range, matching trip_tasks.due_offset_days (which never
-- had this restriction - see 20260819000000_add_pre_trip_preparation.sql).
alter table public.prep_item_templates
  drop constraint prep_item_templates_due_offset_days_is_valid;

alter table public.prep_item_templates
  add constraint prep_item_templates_due_offset_days_is_valid check (
    due_offset_days is null or due_offset_days between 0 and 730
  );
