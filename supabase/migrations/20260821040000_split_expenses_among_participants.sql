create table public.trip_expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.trip_expenses (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  share_amount numeric(14, 2) not null check (share_amount > 0),
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

create index trip_expense_shares_expense_id_idx
  on public.trip_expense_shares (expense_id);
create index trip_expense_shares_trip_id_idx
  on public.trip_expense_shares (trip_id);

alter table public.trip_expense_shares enable row level security;

grant select on table public.trip_expense_shares to authenticated;
grant all on table public.trip_expense_shares to service_role;

create policy "Participants can view expense shares"
on public.trip_expense_shares
for select
to authenticated
using ((select private.is_trip_participant(trip_expense_shares.trip_id, auth.uid())));

-- Splitting an expense requires a cross-row invariant (shares must sum to
-- the expense total) that a column check constraint can't express. Rather
-- than trust every future write path to re-validate it, route all expense
-- creates/updates through these guarded functions and stop granting direct
-- INSERT/UPDATE on trip_expenses so the invariant can't be bypassed.
revoke insert, update on table public.trip_expenses from authenticated;
drop policy "Participants can create trip expenses" on public.trip_expenses;
drop policy "Participants can update trip expenses" on public.trip_expenses;

create function public.create_expense_with_shares(
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

revoke execute on function public.create_expense_with_shares(
  uuid, text, numeric, text, text, date, uuid, jsonb
) from public, anon;
grant execute on function public.create_expense_with_shares(
  uuid, text, numeric, text, text, date, uuid, jsonb
) to authenticated;

create function public.update_expense_with_shares(
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

revoke execute on function public.update_expense_with_shares(
  uuid, uuid, text, numeric, text, text, date, uuid, jsonb
) from public, anon;
grant execute on function public.update_expense_with_shares(
  uuid, uuid, text, numeric, text, text, date, uuid, jsonb
) to authenticated;
