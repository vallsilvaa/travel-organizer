-- #222: the task/template action was a fixed 6-value enum (#208). Turn it
-- into free text with a length cap instead - the UI keeps the 6 presets as
-- default suggestions (translated, via prep-catalog/shared.ts), plus
-- whatever a visitor has typed before, in a combobox rather than a locked
-- picklist. No backfill needed: existing rows still hold one of the six
-- English keys ('buy', 'book', ...), and the display layer already falls
-- back to showing the raw value verbatim when it isn't a known key - so an
-- old row keeps rendering correctly forever, and only turns into the
-- literal label text ("Comprar") if it's ever re-saved.
alter table public.trip_tasks
  drop constraint trip_tasks_action_check,
  add constraint trip_tasks_action_check check (
    action is null or char_length(trim(action)) between 1 and 50
  );

alter table public.prep_item_templates
  drop constraint prep_item_templates_action_check,
  add constraint prep_item_templates_action_check check (
    action is null or char_length(trim(action)) between 1 and 50
  );

-- New: the itinerary's own, separate action vocabulary (Check-in/
-- Check-out and anything else typed), also free text - see trip_tasks
-- above for why this isn't a fixed enum.
alter table public.itinerary_items
  add column action text check (action is null or char_length(trim(action)) between 1 and 50);

grant update (action) on table public.itinerary_items to authenticated;
