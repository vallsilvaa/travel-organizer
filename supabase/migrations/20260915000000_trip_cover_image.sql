alter table public.trips
  add column cover_image_path text;

-- Cover images live in the same private trip-attachments bucket, under
-- "<trip_id>/cover-<uuid>-<file_name>" - the existing storage.objects
-- policies already authorize by trip folder (see
-- 20260822000000_trip_attachments.sql), so no new bucket or storage policy
-- is needed.

-- Organizer-role participants (not just the creator) can set the cover
-- image, the same broader rule as the destination guide - so this goes
-- through a dedicated RPC instead of the creator-only RLS UPDATE policy on
-- trips (see 20260825010000_destination_guide.sql).
create function public.update_trip_cover_image(
  p_trip_id uuid,
  p_cover_image_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_authorized boolean;
begin
  select
    exists (
      select 1 from public.trips
      where id = p_trip_id and created_by = auth.uid()
    )
    or exists (
      select 1 from public.trip_participants
      where trip_id = p_trip_id and user_id = auth.uid() and role = 'organizer'
    )
  into v_is_authorized;

  if not v_is_authorized then
    raise exception 'not_authorized';
  end if;

  if private.is_trip_archived(p_trip_id) then
    raise exception 'trip_archived';
  end if;

  update public.trips
  set cover_image_path = p_cover_image_path,
      updated_at = now()
  where id = p_trip_id;
end;
$$;

revoke execute on function public.update_trip_cover_image(uuid, text)
  from public, anon;
grant execute on function public.update_trip_cover_image(uuid, text)
  to authenticated;
