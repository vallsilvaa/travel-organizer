-- Organizer's reusable checklist catalog. Trip-scoped items copy from these
-- templates (see trip_tasks.template_id) but never point back writes here -
-- editing a template must never retroactively change items already applied
-- to a trip.
create table public.prep_item_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  item_type text not null check (item_type in ('preparation', 'document_request')),
  category text not null default 'other' check (
    category in ('documents', 'lodging', 'money', 'transport', 'health', 'connectivity', 'packing', 'experiences', 'other')
  ),
  continent text not null check (char_length(trim(continent)) between 1 and 100),
  country text not null check (char_length(trim(country)) between 1 and 100),
  city text check (city is null or char_length(trim(city)) <= 200),
  classification text not null check (classification in ('required', 'recommended', 'optional')),
  due_offset_days smallint not null check (due_offset_days between 0 and 730),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  estimated_amount numeric(14, 2) check (estimated_amount is null or estimated_amount >= 0),
  document_instructions text check (document_instructions is null or char_length(document_instructions) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prep_item_templates_document_instructions_required check (
    item_type <> 'document_request'
    or (document_instructions is not null and char_length(trim(document_instructions)) > 0)
  )
);

create index prep_item_templates_owner_id_idx
  on public.prep_item_templates (owner_id);

alter table public.prep_item_templates enable row level security;

revoke all on table public.prep_item_templates from anon;
grant select, insert, update, delete on table public.prep_item_templates to authenticated;
grant all on table public.prep_item_templates to service_role;

create policy "Owners can view their prep item templates"
on public.prep_item_templates
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy "Owners can create prep item templates"
on public.prep_item_templates
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners can update their prep item templates"
on public.prep_item_templates
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners can delete their prep item templates"
on public.prep_item_templates
for delete
to authenticated
using (owner_id = (select auth.uid()));
