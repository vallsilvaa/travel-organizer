alter table public.trip_tasks
  drop constraint trip_tasks_category_is_valid;
alter table public.trip_tasks
  add constraint trip_tasks_category_is_valid check (
    category in ('documents', 'lodging', 'money', 'transport', 'health', 'connectivity', 'packing', 'experiences', 'other')
  );
