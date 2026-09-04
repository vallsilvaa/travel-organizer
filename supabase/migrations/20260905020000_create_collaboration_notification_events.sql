-- Event-driven notifications (#142/#144: "an organizer/traveler changed
-- something relevant") are fired synchronously from Server Actions rather
-- than a DB trigger, since only app code can compute "who should be
-- notified" (organizer vs traveler audience) and send email. This table is
-- the idempotency ledger: one row per mutation (not per recipient), so a
-- same-minute retry of the identical action is a no-op, while a genuinely
-- later edit falls into a new minute bucket and notifies again correctly.
-- Mirrors the upsert-claim idiom already used by task_reminder_deliveries.
create table public.collaboration_notification_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in ('itinerary_item', 'reservation', 'trip_task', 'trip_expense', 'item_comment')
  ),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  actor_id uuid not null references auth.users (id) on delete cascade,
  occurred_minute timestamptz not null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, action, occurred_minute)
);

alter table public.collaboration_notification_events enable row level security;

-- No policies: this table is never read or written directly by
-- authenticated/anon, only through the security definer RPCs below (same
-- pattern as public.notifications itself).
revoke all on table public.collaboration_notification_events from anon, authenticated;
grant all on table public.collaboration_notification_events to service_role;

create function public.claim_collaboration_notification_event(
  p_entity_type text,
  p_entity_id uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  insert into public.collaboration_notification_events (
    entity_type, entity_id, action, actor_id, occurred_minute
  ) values (
    p_entity_type, p_entity_id, p_action, auth.uid(), date_trunc('minute', now())
  )
  on conflict (entity_type, entity_id, action, occurred_minute) do nothing
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke execute on function public.claim_collaboration_notification_event(text, uuid, text)
  from public, anon;
grant execute on function public.claim_collaboration_notification_event(text, uuid, text)
  to authenticated;

-- notifications has no INSERT grant for authenticated (see
-- 20260823000000_notification_center.sql) - every existing type is written
-- by a trigger or the service-role cron client. This RPC is the equivalent
-- write path for the new event-driven types, validating both that the
-- caller belongs to the trip and that every recipient does too (a caller
-- can't fabricate notifications for users outside the trip).
create function public.create_collaboration_notifications(
  p_trip_id uuid,
  p_recipient_ids uuid[],
  p_notification_type text,
  p_title text,
  p_body text,
  p_link_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_trip_participant(p_trip_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;

  insert into public.notifications (user_id, trip_id, notification_type, title, body, link_path)
  select recipient_id, p_trip_id, p_notification_type, p_title, p_body, p_link_path
  from unnest(p_recipient_ids) as recipient_id
  where private.is_trip_participant(p_trip_id, recipient_id);
end;
$$;

revoke execute on function public.create_collaboration_notifications(uuid, uuid[], text, text, text, text)
  from public, anon;
grant execute on function public.create_collaboration_notifications(uuid, uuid[], text, text, text, text)
  to authenticated;

-- Server Actions run with the caller's own RLS-scoped client (no
-- auth.users access, and profiles has no email column / is
-- read-your-own-row-only), so there is no existing way for one
-- participant's action to resolve another participant's email to send
-- the collaboration-change email to. Mirrors get_trip_participants'
-- shape/security (security definer, scoped to the requesting trip) but
-- kept as its own function - deliberately not merged into
-- get_trip_participants, whose result already flows into client-rendered
-- pickers, to avoid emails ending up in output that was never meant to
-- carry them.
-- Also returns collaboration_emails_enabled in the same call: profiles'
-- own RLS policy only lets a user read their own row, so a normal
-- participant's action can't check anyone else's preference directly
-- either - resolving both here avoids a second RLS-blocked query.
create function public.get_trip_participant_emails(
  requested_trip_id uuid,
  requested_user_ids uuid[]
)
returns table (user_id uuid, email text, collaboration_emails_enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email, coalesce(p.collaboration_emails_enabled, true)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = any(requested_user_ids)
    and private.is_trip_participant(requested_trip_id, auth.uid())
    and private.is_trip_participant(requested_trip_id, u.id);
$$;

revoke execute on function public.get_trip_participant_emails(uuid, uuid[])
  from public, anon;
grant execute on function public.get_trip_participant_emails(uuid, uuid[])
  to authenticated;
