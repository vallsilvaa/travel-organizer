create table public.item_comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  item_type text not null check (item_type in ('itinerary', 'task')),
  itinerary_item_id uuid references public.itinerary_items (id) on delete cascade,
  task_id uuid references public.trip_tasks (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_comment_target_matches_type check (
    (item_type = 'itinerary' and itinerary_item_id is not null and task_id is null)
    or (item_type = 'task' and task_id is not null and itinerary_item_id is null)
  )
);

create index item_comments_trip_created_at_idx
  on public.item_comments (trip_id, created_at);
create index item_comments_itinerary_item_idx
  on public.item_comments (itinerary_item_id) where itinerary_item_id is not null;
create index item_comments_task_idx
  on public.item_comments (task_id) where task_id is not null;

alter table public.item_comments enable row level security;

grant select, insert, delete on table public.item_comments to authenticated;
grant update (body, updated_at) on table public.item_comments to authenticated;
grant all on table public.item_comments to service_role;

create policy "Participants can view item comments"
on public.item_comments
for select
to authenticated
using (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = item_comments.trip_id
      and participant.user_id = (select auth.uid())
  )
);

create policy "Participants can create item comments"
on public.item_comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = item_comments.trip_id
      and participant.user_id = (select auth.uid())
  )
  and (
    (
      item_type = 'itinerary'
      and exists (
        select 1 from public.itinerary_items item
        where item.id = item_comments.itinerary_item_id
          and item.trip_id = item_comments.trip_id
      )
    )
    or (
      item_type = 'task'
      and exists (
        select 1 from public.trip_tasks task
        where task.id = item_comments.task_id
          and task.trip_id = item_comments.trip_id
      )
    )
  )
);

create policy "Authors can update their item comments"
on public.item_comments
for update
to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy "Authors can delete their item comments"
on public.item_comments
for delete
to authenticated
using (author_id = (select auth.uid()));
