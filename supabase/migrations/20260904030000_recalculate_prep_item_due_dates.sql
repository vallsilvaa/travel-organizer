-- Keeps due_date in sync with "days before departure" whenever a trip's
-- start_date moves. Not scoped to governed prep items only: the England
-- checklist (20260819000000_add_pre_trip_preparation.sql) already stores
-- due_offset_days and never recalculated on a date change, so this fixes
-- that gap uniformly for every trip_tasks row that has an offset. Completed
-- items keep their original due_date as part of their completion audit.
create function private.recalculate_trip_task_due_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.start_date is distinct from old.start_date then
    update public.trip_tasks
    set due_date = new.start_date - due_offset_days,
        updated_at = now()
    where trip_id = new.id
      and due_offset_days is not null
      and completed_at is null;
  end if;
  return new;
end;
$$;

create trigger trips_recalculate_prep_item_due_dates
after update of start_date on public.trips
for each row
execute function private.recalculate_trip_task_due_dates();
