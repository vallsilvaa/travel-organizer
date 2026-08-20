-- Centralize trip membership checks in an unexposed schema. The function is
-- security definer so policies can validate any participant without being
-- restricted by the caller's own trip_participants SELECT policy.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_trip_participant(
  requested_trip_id uuid,
  requested_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_user_id is not null
    and exists (
      select 1
      from public.trip_participants participant
      where participant.trip_id = requested_trip_id
        and participant.user_id = requested_user_id
    );
$$;

revoke execute on function private.is_trip_participant(uuid, uuid)
  from public, anon;
grant execute on function private.is_trip_participant(uuid, uuid)
  to authenticated;

-- Signed-out visitors must not inherit access if project defaults change.
revoke all on table
  public.profiles,
  public.trips,
  public.trip_participants,
  public.trip_invitations,
  public.itinerary_items,
  public.trip_tasks,
  public.item_comments,
  public.trip_expenses,
  public.task_reminder_deliveries
from anon;

-- Keep immutable identifiers and audit fields out of client UPDATE grants.
revoke update on table public.profiles from authenticated;
grant update (display_name, task_reminders_enabled, updated_at)
  on table public.profiles to authenticated;

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
  reference_label,
  reference_url
)
  on table public.trip_tasks to authenticated;

revoke update on table public.trip_expenses from authenticated;
grant update (
  description,
  amount,
  currency,
  category,
  expense_date,
  payer_id,
  updated_at
)
  on table public.trip_expenses to authenticated;

-- Replace repeated membership subqueries with the audited helper.
drop policy "Participants can view their trips" on public.trips;
create policy "Participants can view their trips"
on public.trips
for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.is_trip_participant(trips.id, auth.uid()))
);

drop policy "Participants can view itinerary items" on public.itinerary_items;
create policy "Participants can view itinerary items"
on public.itinerary_items
for select
to authenticated
using ((select private.is_trip_participant(itinerary_items.trip_id, auth.uid())));

drop policy "Participants can create itinerary items" on public.itinerary_items;
create policy "Participants can create itinerary items"
on public.itinerary_items
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(itinerary_items.trip_id, auth.uid()))
);

drop policy "Participants can update itinerary items" on public.itinerary_items;
create policy "Participants can update itinerary items"
on public.itinerary_items
for update
to authenticated
using ((select private.is_trip_participant(itinerary_items.trip_id, auth.uid())))
with check ((select private.is_trip_participant(itinerary_items.trip_id, auth.uid())));

drop policy "Participants can delete itinerary items" on public.itinerary_items;
create policy "Participants can delete itinerary items"
on public.itinerary_items
for delete
to authenticated
using ((select private.is_trip_participant(itinerary_items.trip_id, auth.uid())));

drop policy "Participants can view trip tasks" on public.trip_tasks;
create policy "Participants can view trip tasks"
on public.trip_tasks
for select
to authenticated
using ((select private.is_trip_participant(trip_tasks.trip_id, auth.uid())));

drop policy "Participants can create trip tasks" on public.trip_tasks;
create policy "Participants can create trip tasks"
on public.trip_tasks
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and (
    owner_id is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.owner_id))
  )
  and (
    completed_by is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.completed_by))
  )
);

drop policy "Participants can update trip tasks" on public.trip_tasks;
create policy "Participants can update trip tasks"
on public.trip_tasks
for update
to authenticated
using ((select private.is_trip_participant(trip_tasks.trip_id, auth.uid())))
with check (
  (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and (
    owner_id is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.owner_id))
  )
  and (
    completed_by is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.completed_by))
  )
);

drop policy "Participants can delete trip tasks" on public.trip_tasks;
create policy "Participants can delete trip tasks"
on public.trip_tasks
for delete
to authenticated
using ((select private.is_trip_participant(trip_tasks.trip_id, auth.uid())));

drop policy "Participants can view item comments" on public.item_comments;
create policy "Participants can view item comments"
on public.item_comments
for select
to authenticated
using ((select private.is_trip_participant(item_comments.trip_id, auth.uid())));

drop policy "Participants can create item comments" on public.item_comments;
create policy "Participants can create item comments"
on public.item_comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (select private.is_trip_participant(item_comments.trip_id, auth.uid()))
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

drop policy "Authors can update their item comments" on public.item_comments;
create policy "Authors can update their item comments"
on public.item_comments
for update
to authenticated
using (
  author_id = (select auth.uid())
  and (select private.is_trip_participant(item_comments.trip_id, auth.uid()))
)
with check (
  author_id = (select auth.uid())
  and (select private.is_trip_participant(item_comments.trip_id, auth.uid()))
);

drop policy "Authors can delete their item comments" on public.item_comments;
create policy "Authors can delete their item comments"
on public.item_comments
for delete
to authenticated
using (
  author_id = (select auth.uid())
  and (select private.is_trip_participant(item_comments.trip_id, auth.uid()))
);

drop policy "Participants can view trip expenses" on public.trip_expenses;
create policy "Participants can view trip expenses"
on public.trip_expenses
for select
to authenticated
using ((select private.is_trip_participant(trip_expenses.trip_id, auth.uid())));

drop policy "Participants can create trip expenses" on public.trip_expenses;
create policy "Participants can create trip expenses"
on public.trip_expenses
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(trip_expenses.trip_id, auth.uid()))
  and (select private.is_trip_participant(trip_expenses.trip_id, trip_expenses.payer_id))
);

drop policy "Participants can update trip expenses" on public.trip_expenses;
create policy "Participants can update trip expenses"
on public.trip_expenses
for update
to authenticated
using ((select private.is_trip_participant(trip_expenses.trip_id, auth.uid())))
with check (
  (select private.is_trip_participant(trip_expenses.trip_id, auth.uid()))
  and (select private.is_trip_participant(trip_expenses.trip_id, trip_expenses.payer_id))
);

drop policy "Participants can delete trip expenses" on public.trip_expenses;
create policy "Participants can delete trip expenses"
on public.trip_expenses
for delete
to authenticated
using ((select private.is_trip_participant(trip_expenses.trip_id, auth.uid())));

drop policy "Users can view their reminder delivery status"
  on public.task_reminder_deliveries;
create policy "Participants can view their reminder delivery status"
on public.task_reminder_deliveries
for select
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.trip_tasks task
    where task.id = task_reminder_deliveries.task_id
      and (select private.is_trip_participant(task.trip_id, auth.uid()))
  )
);

-- Keep the participant-list RPC public-facing but membership-gated. Trigger
-- functions are not API operations and no client role needs to execute them.
create or replace function public.get_trip_participants(requested_trip_id uuid)
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
    and private.is_trip_participant(requested_trip_id, auth.uid())
  order by profile.display_name;
$$;

revoke execute on function public.get_trip_participants(uuid)
  from public, anon;
grant execute on function public.get_trip_participants(uuid)
  to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_trip_creator_as_participant()
  from public, anon, authenticated;
revoke execute on function public.add_accepted_organizer_to_trip()
  from public, anon, authenticated;

-- New public functions are private until a later migration explicitly grants
-- the minimum role required by the application.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
