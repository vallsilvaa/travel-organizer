alter table public.itinerary_items
  add column city text check (city is null or char_length(trim(city)) <= 200);

grant update (city) on table public.itinerary_items to authenticated;
