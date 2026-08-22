create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  notification_type text not null check (
    notification_type in ('invitation', 'task_assigned', 'comment', 'deadline')
  ),
  title text not null check (char_length(trim(title)) between 1 and 200),
  body text check (body is null or char_length(body) <= 500),
  link_path text not null check (char_length(link_path) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

-- Rows are only ever inserted by SECURITY DEFINER trigger functions below
-- (or the service-role cron job), which bypass RLS as the function owner -
-- no INSERT policy is granted to authenticated users.
grant select, delete on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

create policy "Users can view their notifications"
on public.notifications
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can mark their notifications read"
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their notifications"
on public.notifications
for delete
to authenticated
using (user_id = (select auth.uid()));

-- Invitation notifications: only fires if the invited email already
-- belongs to a registered user (matches an existing account).
create function public.notify_on_trip_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invited_user_id uuid;
begin
  select id into v_invited_user_id
  from auth.users
  where lower(email) = new.email
  limit 1;

  if v_invited_user_id is not null then
    insert into public.notifications (user_id, trip_id, notification_type, title, body, link_path)
    values (
      v_invited_user_id,
      new.trip_id,
      'invitation',
      'Convite para organizar uma viagem',
      'Você foi convidado para organizar ' || new.trip_destination || '.',
      '/dashboard'
    );
  end if;

  return new;
end;
$$;

create trigger on_trip_invitation_created
  after insert on public.trip_invitations
  for each row execute procedure public.notify_on_trip_invitation();

-- Task assignment notifications: fires on insert with an owner, or when an
-- existing task's owner changes. Skips self-assignment (no need to notify
-- yourself) and unassignment (owner_id set to null).
create function public.notify_on_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null
    and new.owner_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id)
  then
    insert into public.notifications (user_id, trip_id, notification_type, title, body, link_path)
    values (
      new.owner_id,
      new.trip_id,
      'task_assigned',
      'Nova tarefa atribuída a você',
      new.title,
      '/trips/' || new.trip_id || '?tab=preparation'
    );
  end if;

  return new;
end;
$$;

create trigger on_trip_task_assigned
  after insert or update of owner_id on public.trip_tasks
  for each row execute procedure public.notify_on_task_assignment();

-- Comment notifications: notify the item's creator, unless they are the
-- one commenting.
create function public.notify_on_item_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_link text;
begin
  if new.item_type = 'itinerary' then
    select created_by into v_recipient
    from public.itinerary_items
    where id = new.itinerary_item_id;
    v_link := '/trips/' || new.trip_id || '?tab=itinerary';
  else
    select created_by into v_recipient
    from public.trip_tasks
    where id = new.task_id;
    v_link := '/trips/' || new.trip_id || '?tab=preparation';
  end if;

  if v_recipient is not null and v_recipient <> new.author_id then
    insert into public.notifications (user_id, trip_id, notification_type, title, body, link_path)
    values (v_recipient, new.trip_id, 'comment', 'Novo comentário', left(new.body, 200), v_link);
  end if;

  return new;
end;
$$;

create trigger on_item_comment_created
  after insert on public.item_comments
  for each row execute procedure public.notify_on_item_comment();
