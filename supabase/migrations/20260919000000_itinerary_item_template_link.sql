-- #222: expose the personal catalog (prep_item_templates, already
-- supporting item_type = 'itinerary_item') in the Roteiro tab too, not
-- just Preparação. Applying a catalog item into the itinerary needs the
-- same traceability + duplicate-prevention trip_tasks already has via
-- template_id (see 20260904010000_add_prep_fields_to_trip_tasks.sql and
-- 20260910000000_prevent_duplicate_catalog_tasks.sql).
alter table public.itinerary_items
  add column template_id uuid references public.prep_item_templates (id) on delete set null;

-- Same rationale as trip_tasks_trip_template_id_unique: identity is by
-- template_id, and a partial unique index (not a plain check) lets a
-- removed copy free the template back up for re-adding.
create unique index itinerary_items_trip_template_id_unique
  on public.itinerary_items (trip_id, template_id)
  where template_id is not null;
