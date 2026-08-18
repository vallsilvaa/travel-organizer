create table public.trip_tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  owner_id uuid references auth.users (id) on delete set null,
  due_date date,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_task_completion_is_consistent check (
    (completed_at is null and completed_by is null)
    or (completed_at is not null and completed_by is not null)
  )
);

create index trip_tasks_trip_status_due_date_idx
  on public.trip_tasks (trip_id, completed_at, due_date);
create index trip_tasks_owner_id_idx on public.trip_tasks (owner_id);

alter table public.trip_tasks enable row level security;

grant select, insert, update on table public.trip_tasks to authenticated;
grant all on table public.trip_tasks to service_role;

create policy "Participants can view trip tasks"
on public.trip_tasks
for select
to authenticated
using (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_tasks.trip_id
      and participant.user_id = (select auth.uid())
  )
);

create policy "Participants can create trip tasks"
on public.trip_tasks
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_tasks.trip_id
      and participant.user_id = (select auth.uid())
  )
  and (
    owner_id is null
    or exists (
      select 1 from public.trip_participants owner
      where owner.trip_id = trip_tasks.trip_id
        and owner.user_id = trip_tasks.owner_id
    )
  )
);

create policy "Participants can update trip tasks"
on public.trip_tasks
for update
to authenticated
using (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_tasks.trip_id
      and participant.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_tasks.trip_id
      and participant.user_id = (select auth.uid())
  )
  and (
    owner_id is null
    or exists (
      select 1 from public.trip_participants owner
      where owner.trip_id = trip_tasks.trip_id
        and owner.user_id = trip_tasks.owner_id
    )
  )
);

create function public.get_trip_participants(requested_trip_id uuid)
returns table (user_id uuid, display_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select participant.user_id, profile.display_name, participant.role
  from public.trip_participants participant
  join public.profiles profile on profile.id = participant.user_id
  where participant.trip_id = requested_trip_id
    and exists (
      select 1 from public.trip_participants viewer
      where viewer.trip_id = requested_trip_id
        and viewer.user_id = (select auth.uid())
    )
  order by profile.display_name;
$$;

grant execute on function public.get_trip_participants(uuid) to authenticated;
