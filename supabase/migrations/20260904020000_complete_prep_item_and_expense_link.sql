-- Completing a prep item is more than a column flip once it can generate a
-- linked expense: creating the expense/share rows and stamping expense_id
-- back onto the task is a cross-row invariant that a check constraint can't
-- express, so (same precedent as create_expense_with_shares in
-- 20260821040000_split_expenses_among_participants.sql) it moves behind a
-- security definer RPC and completed_at/completed_by/expense_id stop being
-- directly writable by authenticated.
revoke update (completed_at, completed_by) on table public.trip_tasks from authenticated;

create function public.complete_prep_item(
  p_task_id uuid,
  p_should_complete boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.trip_tasks;
  v_new_expense_id uuid;
  v_expense_category text;
begin
  select * into v_task from public.trip_tasks where id = p_task_id;

  if v_task.id is null then
    raise exception 'task_not_found';
  end if;

  if not private.is_trip_participant(v_task.trip_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  if private.is_trip_archived(v_task.trip_id) then
    raise exception 'trip_archived';
  end if;

  if p_should_complete then
    update public.trip_tasks
    set completed_at = now(),
        completed_by = auth.uid(),
        updated_at = now()
    where id = p_task_id;

    -- Only ever create one expense per task: guarded by expense_id is null,
    -- so retrying/re-submitting an already-completed item is a no-op here.
    if v_task.expense_id is null
      and v_task.estimated_amount is not null
      and v_task.paid_amount is not null
      and v_task.paid_amount > 0
    then
      v_expense_category := case v_task.category
        when 'lodging' then 'lodging'
        when 'transport' then 'transport'
        else 'other'
      end;

      insert into public.trip_expenses (
        trip_id, description, amount, currency, category, expense_date, payer_id, created_by
      ) values (
        v_task.trip_id,
        v_task.title,
        v_task.paid_amount,
        coalesce(v_task.currency, 'USD'),
        v_expense_category,
        current_date,
        auth.uid(),
        auth.uid()
      )
      returning id into v_new_expense_id;

      insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount)
      values (v_new_expense_id, v_task.trip_id, auth.uid(), v_task.paid_amount);

      update public.trip_tasks set expense_id = v_new_expense_id where id = p_task_id;
    end if;
  else
    update public.trip_tasks
    set completed_at = null,
        completed_by = null,
        updated_at = now()
    where id = p_task_id;

    -- Reopening drops the auto-generated expense so nothing orphaned is
    -- left behind; the task can regenerate a fresh one on re-completion.
    if v_task.expense_id is not null then
      delete from public.trip_expenses where id = v_task.expense_id;
      update public.trip_tasks set expense_id = null where id = p_task_id;
    end if;
  end if;
end;
$$;

revoke execute on function public.complete_prep_item(uuid, boolean) from public, anon;
grant execute on function public.complete_prep_item(uuid, boolean) to authenticated;

-- Hard-deleting a task with a linked expense must not leave that expense
-- orphaned either; runs as security definer since authenticated has no
-- direct delete grant on trip_expenses (revoked in
-- 20260821040000_split_expenses_among_participants.sql).
create function private.delete_linked_expense_before_task_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.expense_id is not null then
    delete from public.trip_expenses where id = old.expense_id;
  end if;
  return old;
end;
$$;

create trigger trip_tasks_delete_linked_expense
before delete on public.trip_tasks
for each row
execute function private.delete_linked_expense_before_task_delete();
