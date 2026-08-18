alter table public.profiles
  add column task_reminders_enabled boolean not null default true;

create table public.task_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.trip_tasks (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  due_date date not null,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'failed')
  ),
  provider_message_id text,
  failure_code text check (
    failure_code is null or char_length(failure_code) <= 100
  ),
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint one_reminder_per_task_deadline unique (task_id, due_date)
);

create index task_reminder_deliveries_owner_id_idx
  on public.task_reminder_deliveries (owner_id, created_at desc);

alter table public.task_reminder_deliveries enable row level security;

grant select on table public.task_reminder_deliveries to authenticated;
grant all on table public.task_reminder_deliveries to service_role;

create policy "Users can view their reminder delivery status"
on public.task_reminder_deliveries
for select
to authenticated
using (owner_id = (select auth.uid()));
