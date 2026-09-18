-- Remodeling the trip concept (#213): a trip now has its own title,
-- separate from its destination(s) (e.g. "Partiu Minas" vs. "Minas
-- Gerais, Brasil"), and an end date is no longer optional - every trip
-- needs a defined return date.

alter table public.trips
  add column title text;

-- Existing trips predate the title field - the closest thing they already
-- had was the free-text destination, so that's the best available seed.
update public.trips
set title = destination
where title is null;

alter table public.trips
  alter column title set not null,
  add constraint trips_title_length check (char_length(trim(title)) between 1 and 200);

-- Existing trips created without an end date were always treated as a
-- single-day trip everywhere in the app (see e.g. tripLastDay = end_date ??
-- start_date on the trip page) - backfill makes that implicit rule explicit
-- before the column stops accepting nulls.
update public.trips
set end_date = start_date
where end_date is null;

alter table public.trips
  alter column end_date set not null;

-- The create/update trip actions always send both title and end_date now
-- (the trip form makes both required fields), so this trigger only ever
-- matters for callers that insert a trip without them directly - it keeps
-- the same graceful fallback the app already used at read time (title
-- mirroring destination, a single-day trip defaulting its end date to its
-- start date) instead of forcing every such caller to know about the new
-- columns.
create function private.default_trip_title_and_end_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.title is null then
    new.title := new.destination;
  end if;
  if new.end_date is null then
    new.end_date := new.start_date;
  end if;
  return new;
end;
$$;

create trigger trips_default_title_and_end_date
  before insert on public.trips
  for each row execute procedure private.default_trip_title_and_end_date();

grant update (title) on table public.trips to authenticated;
