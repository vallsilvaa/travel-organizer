alter table public.trips
  add column timezone text not null default 'UTC';

grant update (timezone) on table public.trips to authenticated;
