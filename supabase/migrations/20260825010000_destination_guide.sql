alter table public.trips
  add column destination_guide_content text,
  add column destination_guide_source text,
  add column destination_guide_reviewed_at date,
  add constraint trips_destination_guide_content_length
    check (destination_guide_content is null or char_length(trim(destination_guide_content)) between 1 and 5000),
  add constraint trips_destination_guide_source_length
    check (destination_guide_source is null or char_length(trim(destination_guide_source)) between 1 and 300);

-- The destination guide is editable by the trip creator or any organizer,
-- unlike the rest of the trip's core fields which only the creator can
-- change (see 20260820020000_allow_trip_creators_to_edit_and_delete.sql).
-- That's a broader authorization rule than the creator-only RLS UPDATE
-- policy on public.trips, so it goes through a dedicated RPC instead of a
-- plain table update.
create function public.update_destination_guide(
  p_trip_id uuid,
  p_content text,
  p_source text,
  p_reviewed_at date
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
  set destination_guide_content = p_content,
      destination_guide_source = p_source,
      destination_guide_reviewed_at = p_reviewed_at,
      updated_at = now()
  where id = p_trip_id;
end;
$$;

revoke execute on function public.update_destination_guide(uuid, text, text, date)
  from public, anon;
grant execute on function public.update_destination_guide(uuid, text, text, date)
  to authenticated;
