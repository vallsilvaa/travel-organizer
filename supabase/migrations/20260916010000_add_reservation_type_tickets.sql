-- #203: adds "tickets" (shows, museums, parks, events) as a fourth
-- reservation type, alongside flight/lodging/transport.
alter table public.trip_reservations
  drop constraint trip_reservations_reservation_type_check;

alter table public.trip_reservations
  add constraint trip_reservations_reservation_type_check
  check (reservation_type in ('flight', 'lodging', 'transport', 'tickets'));

-- A tickets reservation maps to the "activities" expense category instead
-- of falling through to "other", same idea as the existing lodging/flight
-- mappings below.
create or replace function private.reservation_expense_category(p_reservation_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reservation_type
    when 'lodging' then 'lodging'
    when 'flight' then 'transport'
    when 'transport' then 'transport'
    when 'tickets' then 'activities'
    else 'other'
  end;
$$;
