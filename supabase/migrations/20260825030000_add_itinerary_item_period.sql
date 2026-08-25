alter table public.itinerary_items
  add column period text check (period is null or period in ('morning', 'afternoon', 'evening'));

grant update (period) on table public.itinerary_items to authenticated;
