-- Applies the reusable prep-item catalog to trip_tasks instead of a second
-- parallel table: trip_tasks is already the trip's preparation checklist
-- (see 20260819000000_add_pre_trip_preparation.sql), and document requests
-- must appear in that same flow without a second screen for travelers.
--
-- A row is a "governed" prep item iff classification is not null - that's
-- only ever set by the catalog/apply flow, so every predicate added below is
-- scoped to it and pre-existing ad-hoc tasks (classification is null) keep
-- their exact current behavior.
alter table public.trip_tasks
  add column item_type text not null default 'preparation'
    check (item_type in ('preparation', 'document_request')),
  add column template_id uuid references public.prep_item_templates (id) on delete set null,
  add column continent text check (
    continent is null
    or continent in ('africa', 'antarctica', 'asia', 'europe', 'north_america', 'oceania', 'south_america')
  ),
  add column country text check (country is null or char_length(trim(country)) between 1 and 100),
  add column city text check (city is null or char_length(trim(city)) <= 200),
  add column classification text check (classification is null or classification in ('required', 'recommended', 'optional')),
  add column currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  add column estimated_amount numeric(14, 2) check (estimated_amount is null or estimated_amount >= 0),
  add column paid_amount numeric(14, 2) check (paid_amount is null or paid_amount >= 0),
  add column itinerary_item_id uuid references public.itinerary_items (id) on delete set null,
  add column document_instructions text check (document_instructions is null or char_length(document_instructions) <= 2000),
  add column expense_id uuid references public.trip_expenses (id) on delete set null,
  add constraint trip_tasks_document_instructions_required check (
    item_type <> 'document_request'
    or (document_instructions is not null and char_length(trim(document_instructions)) > 0)
  ),
  -- classification is only ever set by the catalog/apply flow, which always
  -- supplies continent/country too (both required fields on the item) - see
  -- prep_item_templates' own not-null constraints on the same two columns.
  add constraint trip_tasks_governed_item_has_location check (
    classification is null or (continent is not null and country is not null)
  );

create index trip_tasks_trip_classification_idx
  on public.trip_tasks (trip_id, classification)
  where classification is not null;

create index trip_tasks_itinerary_item_id_idx
  on public.trip_tasks (itinerary_item_id)
  where itinerary_item_id is not null;

-- expense_id, completed_at and completed_by are intentionally left out of
-- this grant - see 20260904020000_complete_prep_item_and_expense_link.sql,
-- which moves those to an RPC-only write path.
grant update (
  item_type,
  template_id,
  continent,
  country,
  city,
  classification,
  currency,
  estimated_amount,
  paid_amount,
  itinerary_item_id,
  document_instructions
) on table public.trip_tasks to authenticated;

-- Mirrors private.is_trip_participant: a trip's creator is always an
-- organizer regardless of their trip_participants row, and an invited
-- participant can also be granted the organizer role (see
-- 20260825050000_invite_participant_role.sql).
create function private.is_trip_organizer(
  requested_trip_id uuid,
  requested_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_user_id is not null
    and (
      exists (
        select 1
        from public.trips trip
        where trip.id = requested_trip_id
          and trip.created_by = requested_user_id
      )
      or exists (
        select 1
        from public.trip_participants participant
        where participant.trip_id = requested_trip_id
          and participant.user_id = requested_user_id
          and participant.role = 'organizer'
      )
    );
$$;

revoke execute on function private.is_trip_organizer(uuid, uuid) from public, anon;
grant execute on function private.is_trip_organizer(uuid, uuid) to authenticated;

drop policy "Participants can create trip tasks" on public.trip_tasks;
create policy "Participants can create trip tasks"
on public.trip_tasks
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_tasks.trip_id))
  and (
    owner_id is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.owner_id))
  )
  and (
    completed_by is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.completed_by))
  )
  and (
    classification is null
    or (select private.is_trip_organizer(trip_tasks.trip_id, auth.uid()))
  )
  and (
    itinerary_item_id is null
    or exists (
      select 1
      from public.itinerary_items item
      where item.id = trip_tasks.itinerary_item_id
        and item.trip_id = trip_tasks.trip_id
    )
  )
);

drop policy "Participants can update trip tasks" on public.trip_tasks;
create policy "Participants can update trip tasks"
on public.trip_tasks
for update
to authenticated
using ((select private.is_trip_participant(trip_tasks.trip_id, auth.uid())))
with check (
  (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_tasks.trip_id))
  and (
    owner_id is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.owner_id))
  )
  and (
    completed_by is null
    or (select private.is_trip_participant(trip_tasks.trip_id, trip_tasks.completed_by))
  )
  and (
    classification is null
    or (select private.is_trip_organizer(trip_tasks.trip_id, auth.uid()))
  )
  and (
    itinerary_item_id is null
    or exists (
      select 1
      from public.itinerary_items item
      where item.id = trip_tasks.itinerary_item_id
        and item.trip_id = trip_tasks.trip_id
    )
  )
);

drop policy "Participants can delete trip tasks" on public.trip_tasks;
create policy "Participants can delete trip tasks"
on public.trip_tasks
for delete
to authenticated
using (
  (select private.is_trip_participant(trip_tasks.trip_id, auth.uid()))
  and not (select private.is_trip_archived(trip_tasks.trip_id))
  and (
    classification is null
    or (select private.is_trip_organizer(trip_tasks.trip_id, auth.uid()))
  )
);
