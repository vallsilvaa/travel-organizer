-- Allows a trip_attachments row to be linked to an expense (receipt/invoice),
-- alongside the existing itinerary/task/reservation item types (#186). No
-- storage or RLS policy change needed: trip-attachments' policies already
-- authorize by trip folder alone (see 20260822000000_trip_attachments.sql),
-- and trip_attachments' own RLS is scoped by trip_id, not item_type.
alter table public.trip_attachments
  drop constraint trip_attachments_item_type_check;

alter table public.trip_attachments
  add constraint trip_attachments_item_type_check
  check (item_type in ('itinerary', 'task', 'reservation', 'expense'));
