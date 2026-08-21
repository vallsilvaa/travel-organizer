insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-attachments',
  'trip-attachments',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Objects are stored as "<trip_id>/<uuid>-<file_name>", so the first path
-- segment doubles as the authorization key for storage.objects policies.
create policy "Participants can view trip attachment files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trip-attachments'
  and (select private.is_trip_participant((storage.foldername(name))[1]::uuid, auth.uid()))
);

create policy "Participants can upload trip attachment files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-attachments'
  and owner = (select auth.uid())
  and (select private.is_trip_participant((storage.foldername(name))[1]::uuid, auth.uid()))
  and not (select private.is_trip_archived((storage.foldername(name))[1]::uuid))
);

create policy "Participants can delete trip attachment files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-attachments'
  and (select private.is_trip_participant((storage.foldername(name))[1]::uuid, auth.uid()))
  and not (select private.is_trip_archived((storage.foldername(name))[1]::uuid))
);

create table public.trip_attachments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  item_type text check (item_type in ('itinerary', 'task', 'reservation')),
  item_id uuid,
  storage_path text not null unique,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint trip_attachments_item_type_requires_id check (
    (item_type is null) = (item_id is null)
  )
);

create index trip_attachments_trip_idx on public.trip_attachments (trip_id, created_at);
create index trip_attachments_item_idx on public.trip_attachments (item_type, item_id);

alter table public.trip_attachments enable row level security;

grant select, insert, delete on table public.trip_attachments to authenticated;
grant all on table public.trip_attachments to service_role;

create policy "Participants can view trip attachments"
on public.trip_attachments
for select
to authenticated
using (
  (select private.is_trip_participant(trip_attachments.trip_id, auth.uid()))
);

create policy "Participants can record trip attachments"
on public.trip_attachments
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(trip_attachments.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_attachments.trip_id))
);

create policy "Participants can delete trip attachments"
on public.trip_attachments
for delete
to authenticated
using (
  (select private.is_trip_participant(trip_attachments.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_attachments.trip_id))
);
