alter table public.trip_tasks
  add column category text not null default 'other',
  add column due_offset_days smallint,
  add column is_critical boolean not null default false,
  add column template_key text,
  add column reference_label text,
  add column reference_url text,
  add constraint trip_tasks_category_is_valid check (
    category in ('documents', 'lodging', 'money', 'transport', 'health', 'connectivity', 'packing', 'other')
  ),
  add constraint trip_tasks_due_offset_is_valid check (
    due_offset_days is null or due_offset_days between 0 and 730
  ),
  add constraint trip_tasks_template_key_is_valid check (
    template_key is null or char_length(trim(template_key)) between 1 and 100
  ),
  add constraint trip_tasks_reference_label_is_valid check (
    reference_label is null or char_length(trim(reference_label)) between 1 and 100
  ),
  add constraint trip_tasks_reference_url_is_safe check (
    reference_url is null or reference_url ~ '^https://[^[:space:]]+$'
  ),
  add constraint trip_tasks_reference_is_consistent check (
    reference_label is null or reference_url is not null
  ),
  add constraint trip_tasks_trip_template_is_unique unique (trip_id, template_key);

create index trip_tasks_trip_category_idx
  on public.trip_tasks (trip_id, category, completed_at);

grant delete on table public.trip_tasks to authenticated;

create policy "Participants can delete trip tasks"
on public.trip_tasks
for delete
to authenticated
using (
  exists (
    select 1 from public.trip_participants participant
    where participant.trip_id = trip_tasks.trip_id
      and participant.user_id = (select auth.uid())
  )
);
