alter table public.trips
  add column archived_at timestamptz;

grant update (archived_at) on table public.trips to authenticated;

create function private.is_trip_archived(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips trip
    where trip.id = requested_trip_id
      and trip.archived_at is not null
  );
$$;

revoke execute on function private.is_trip_archived(uuid) from public, anon;
grant execute on function private.is_trip_archived(uuid) to authenticated;

-- Archiving freezes planning content (itinerary, tasks, expenses) so a trip
-- can't drift after the fact, while leaving it fully readable and leaving
-- collaboration (participants, invitations, comments) untouched.
drop policy "Participants can create itinerary items" on public.itinerary_items;
create policy "Participants can create itinerary items"
on public.itinerary_items
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(itinerary_items.trip_id, auth.uid()))
  and not (select private.is_trip_archived(itinerary_items.trip_id))
);

drop policy "Participants can update itinerary items" on public.itinerary_items;
create policy "Participants can update itinerary items"
on public.itinerary_items
for update
to authenticated
using ((select private.is_trip_participant(itinerary_items.trip_id, auth.uid())))
with check (
  (select private.is_trip_participant(itinerary_items.trip_id, auth.uid()))
  and not (select private.is_trip_archived(itinerary_items.trip_id))
);

drop policy "Participants can delete itinerary items" on public.itinerary_items;
create policy "Participants can delete itinerary items"
on public.itinerary_items
for delete
to authenticated
using (
  (select private.is_trip_participant(itinerary_items.trip_id, auth.uid()))
  and not (select private.is_trip_archived(itinerary_items.trip_id))
);

drop policy "Participants can create trip tasks" on public.trip_tasks;
create policy "Participants can create trip tasks"
on public.trip_tasks
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_tasks.trip_id))
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
  and not (select private.is_trip_archived(trip_tasks.trip_id))
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
using (
  (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_tasks.trip_id))
);

drop policy "Participants can delete trip expenses" on public.trip_expenses;
create policy "Participants can delete trip expenses"
on public.trip_expenses
for delete
to authenticated
using (
  (select private.is_trip_participant(trip_expenses.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_expenses.trip_id))
);

create or replace function public.create_expense_with_shares(
  p_trip_id uuid,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_expense_date date,
  p_payer_id uuid,
  p_shares jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_shares_total numeric(14, 2);
  v_invalid_share_count int;
begin
  if not private.is_trip_participant(p_trip_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  if private.is_trip_archived(p_trip_id) then
    raise exception 'trip_archived';
  end if;

  if not private.is_trip_participant(p_trip_id, p_payer_id) then
    raise exception 'invalid_payer';
  end if;

  select coalesce(sum((share ->> 'share_amount')::numeric(14, 2)), 0)
  into v_shares_total
  from jsonb_array_elements(p_shares) as share;

  if jsonb_array_length(p_shares) > 0 and v_shares_total <> p_amount then
    raise exception 'shares_do_not_match_total';
  end if;

  select count(*) into v_invalid_share_count
  from jsonb_array_elements(p_shares) as share
  where not private.is_trip_participant(p_trip_id, (share ->> 'user_id')::uuid);

  if v_invalid_share_count > 0 then
    raise exception 'invalid_participant';
  end if;

  insert into public.trip_expenses (
    trip_id, description, amount, currency, category, expense_date, payer_id, created_by
  ) values (
    p_trip_id, p_description, p_amount, p_currency, p_category, p_expense_date, p_payer_id, auth.uid()
  )
  returning id into v_expense_id;

  insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount)
  select v_expense_id, p_trip_id, (share ->> 'user_id')::uuid, (share ->> 'share_amount')::numeric(14, 2)
  from jsonb_array_elements(p_shares) as share
  where (share ->> 'share_amount')::numeric(14, 2) > 0;

  return v_expense_id;
end;
$$;

create or replace function public.update_expense_with_shares(
  p_expense_id uuid,
  p_trip_id uuid,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_expense_date date,
  p_payer_id uuid,
  p_shares jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_id uuid;
  v_shares_total numeric(14, 2);
  v_invalid_share_count int;
begin
  if not private.is_trip_participant(p_trip_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  if private.is_trip_archived(p_trip_id) then
    raise exception 'trip_archived';
  end if;

  if not private.is_trip_participant(p_trip_id, p_payer_id) then
    raise exception 'invalid_payer';
  end if;

  select coalesce(sum((share ->> 'share_amount')::numeric(14, 2)), 0)
  into v_shares_total
  from jsonb_array_elements(p_shares) as share;

  if jsonb_array_length(p_shares) > 0 and v_shares_total <> p_amount then
    raise exception 'shares_do_not_match_total';
  end if;

  select count(*) into v_invalid_share_count
  from jsonb_array_elements(p_shares) as share
  where not private.is_trip_participant(p_trip_id, (share ->> 'user_id')::uuid);

  if v_invalid_share_count > 0 then
    raise exception 'invalid_participant';
  end if;

  update public.trip_expenses
  set description = p_description,
      amount = p_amount,
      currency = p_currency,
      category = p_category,
      expense_date = p_expense_date,
      payer_id = p_payer_id,
      updated_at = now()
  where id = p_expense_id
    and trip_id = p_trip_id
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'expense_not_found';
  end if;

  delete from public.trip_expense_shares where expense_id = p_expense_id;

  insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount)
  select p_expense_id, p_trip_id, (share ->> 'user_id')::uuid, (share ->> 'share_amount')::numeric(14, 2)
  from jsonb_array_elements(p_shares) as share
  where (share ->> 'share_amount')::numeric(14, 2) > 0;
end;
$$;
