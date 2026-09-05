-- Issue #171: an itinerary item's date must fall within its own trip's
-- date range - enforced here (not just in the Server Action) so it can't
-- be bypassed by any future write path. Trips without an end_date only
-- have a single valid day, their start_date, per the issue's explicit
-- rule for open-ended trips.
create function private.validate_itinerary_item_date_range()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_date date;
  v_end_date date;
begin
  select start_date, coalesce(end_date, start_date)
  into v_start_date, v_end_date
  from public.trips
  where id = new.trip_id;

  if new.item_date < v_start_date or new.item_date > v_end_date then
    raise exception 'itinerary_item_date_outside_trip_range';
  end if;

  return new;
end;
$$;

create trigger itinerary_items_validate_date_range
before insert or update of item_date, trip_id on public.itinerary_items
for each row
execute function private.validate_itinerary_item_date_range();
