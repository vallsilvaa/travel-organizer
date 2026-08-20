create or replace function public.is_current_user_trip_participant(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_participants participant
    where participant.trip_id = requested_trip_id
      and participant.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_current_user_trip_participant(uuid) from public;
revoke all on function public.is_current_user_trip_participant(uuid) from anon;
grant execute on function public.is_current_user_trip_participant(uuid)
  to authenticated, service_role;

create or replace function public.is_trip_participant_for_current_user(
  requested_trip_id uuid,
  requested_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_current_user_trip_participant(requested_trip_id)
    and exists (
      select 1
      from public.trip_participants participant
      where participant.trip_id = requested_trip_id
        and participant.user_id = requested_user_id
    );
$$;

revoke all on function public.is_trip_participant_for_current_user(uuid, uuid) from public;
revoke all on function public.is_trip_participant_for_current_user(uuid, uuid) from anon;
grant execute on function public.is_trip_participant_for_current_user(uuid, uuid)
  to authenticated, service_role;

drop policy "Participants can view their trips" on public.trips;
create policy "Participants can view their trips"
on public.trips
for select
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_current_user_trip_participant(id)
);

drop policy "Participants can view itinerary items" on public.itinerary_items;
create policy "Participants can view itinerary items"
on public.itinerary_items
for select
to authenticated
using (public.is_current_user_trip_participant(trip_id));

drop policy "Participants can create itinerary items" on public.itinerary_items;
create policy "Participants can create itinerary items"
on public.itinerary_items
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_current_user_trip_participant(trip_id)
);

drop policy "Participants can update itinerary items" on public.itinerary_items;
create policy "Participants can update itinerary items"
on public.itinerary_items
for update
to authenticated
using (public.is_current_user_trip_participant(trip_id))
with check (public.is_current_user_trip_participant(trip_id));

drop policy "Participants can delete itinerary items" on public.itinerary_items;
create policy "Participants can delete itinerary items"
on public.itinerary_items
for delete
to authenticated
using (public.is_current_user_trip_participant(trip_id));

drop policy "Participants can view trip tasks" on public.trip_tasks;
create policy "Participants can view trip tasks"
on public.trip_tasks
for select
to authenticated
using (public.is_current_user_trip_participant(trip_id));

drop policy "Participants can create trip tasks" on public.trip_tasks;
create policy "Participants can create trip tasks"
on public.trip_tasks
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_current_user_trip_participant(trip_id)
  and (
    owner_id is null
    or public.is_trip_participant_for_current_user(trip_id, owner_id)
  )
  and (
    completed_by is null
    or public.is_trip_participant_for_current_user(trip_id, completed_by)
  )
);

drop policy "Participants can update trip tasks" on public.trip_tasks;
create policy "Participants can update trip tasks"
on public.trip_tasks
for update
to authenticated
using (public.is_current_user_trip_participant(trip_id))
with check (
  public.is_current_user_trip_participant(trip_id)
  and (
    owner_id is null
    or public.is_trip_participant_for_current_user(trip_id, owner_id)
  )
  and (
    completed_by is null
    or public.is_trip_participant_for_current_user(trip_id, completed_by)
  )
);

drop policy "Participants can delete trip tasks" on public.trip_tasks;
create policy "Participants can delete trip tasks"
on public.trip_tasks
for delete
to authenticated
using (public.is_current_user_trip_participant(trip_id));

drop policy "Participants can view item comments" on public.item_comments;
create policy "Participants can view item comments"
on public.item_comments
for select
to authenticated
using (public.is_current_user_trip_participant(trip_id));

drop policy "Participants can create item comments" on public.item_comments;
create policy "Participants can create item comments"
on public.item_comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_current_user_trip_participant(trip_id)
  and (
    (
      item_type = 'itinerary'
      and exists (
        select 1
        from public.itinerary_items item
        where item.id = item_comments.itinerary_item_id
          and item.trip_id = item_comments.trip_id
      )
    )
    or (
      item_type = 'task'
      and exists (
        select 1
        from public.trip_tasks task
        where task.id = item_comments.task_id
          and task.trip_id = item_comments.trip_id
      )
    )
  )
);

drop policy "Participants can view trip expenses" on public.trip_expenses;
create policy "Participants can view trip expenses"
on public.trip_expenses
for select
to authenticated
using (public.is_current_user_trip_participant(trip_id));

drop policy "Participants can create trip expenses" on public.trip_expenses;
create policy "Participants can create trip expenses"
on public.trip_expenses
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_current_user_trip_participant(trip_id)
  and public.is_trip_participant_for_current_user(trip_id, payer_id)
);

drop policy "Participants can update trip expenses" on public.trip_expenses;
create policy "Participants can update trip expenses"
on public.trip_expenses
for update
to authenticated
using (public.is_current_user_trip_participant(trip_id))
with check (
  public.is_current_user_trip_participant(trip_id)
  and public.is_trip_participant_for_current_user(trip_id, payer_id)
);

drop policy "Participants can delete trip expenses" on public.trip_expenses;
create policy "Participants can delete trip expenses"
on public.trip_expenses
for delete
to authenticated
using (public.is_current_user_trip_participant(trip_id));

revoke update on table public.itinerary_items from authenticated;
grant update (item_date, start_time, title, location, notes, updated_at)
  on table public.itinerary_items to authenticated;

revoke update on table public.trip_tasks from authenticated;
grant update (
  title,
  owner_id,
  due_date,
  completed_at,
  completed_by,
  updated_at,
  category,
  due_offset_days,
  is_critical,
  template_key,
  reference_label,
  reference_url
) on table public.trip_tasks to authenticated;

revoke update on table public.trip_expenses from authenticated;
grant update (
  description,
  amount,
  currency,
  category,
  expense_date,
  payer_id,
  updated_at
) on table public.trip_expenses to authenticated;

revoke all on function public.get_trip_participants(uuid) from public;
revoke all on function public.get_trip_participants(uuid) from anon;
grant execute on function public.get_trip_participants(uuid)
  to authenticated, service_role;
