-- Issue #145: a daily digest of overdue preparation tasks, distinct from
-- the preventive due-date reminder (#10 / task_reminder_deliveries), which
-- only ever looks ahead. Keyed by (task, recipient, day) rather than by
-- due_date so a task still overdue tomorrow can alert again - the same
-- claim-then-send idiom as task_reminder_deliveries, just re-armed daily
-- instead of once per deadline.
create table public.overdue_task_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.trip_tasks (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  alert_date date not null,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'failed')
  ),
  provider_message_id text,
  failure_code text check (
    failure_code is null or char_length(failure_code) <= 100
  ),
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint one_overdue_alert_per_task_recipient_day unique (task_id, recipient_id, alert_date)
);

create index overdue_task_reminder_deliveries_recipient_id_idx
  on public.overdue_task_reminder_deliveries (recipient_id, created_at desc);

alter table public.overdue_task_reminder_deliveries enable row level security;

revoke all on table public.overdue_task_reminder_deliveries from anon;

grant select on table public.overdue_task_reminder_deliveries to authenticated;
grant all on table public.overdue_task_reminder_deliveries to service_role;

create policy "Users can view their overdue alert delivery status"
on public.overdue_task_reminder_deliveries
for select
to authenticated
using (recipient_id = (select auth.uid()));
