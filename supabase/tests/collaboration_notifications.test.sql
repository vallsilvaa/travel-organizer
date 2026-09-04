begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('92111111-1111-4111-8111-111111111111', 'organizer@example.com'),
  ('92222222-2222-4222-8222-222222222222', 'traveler@example.com'),
  ('92333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paris', '2027-06-01', '2027-06-10', '92111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  '92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '92222222-2222-4222-8222-222222222222', 'traveler'
);

set local role authenticated;
set local request.jwt.claim.sub = '92111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"92111111-1111-4111-8111-111111111111","email":"organizer@example.com","role":"authenticated"}';

-- Claiming an event for the first time succeeds and returns an id.
select isnt(
  (select public.claim_collaboration_notification_event('itinerary_item', '92bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'created')),
  null,
  'the first claim of an event returns a new event id'
);

-- Re-claiming the identical event within the same minute is a no-op (dedup).
select is(
  (select public.claim_collaboration_notification_event('itinerary_item', '92bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'created')),
  null,
  'reclaiming the same event within the same minute returns null (already handled)'
);

-- A different action on the same entity is a distinct, claimable event.
select isnt(
  (select public.claim_collaboration_notification_event('itinerary_item', '92bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'updated')),
  null,
  'a different action on the same entity is claimable independently'
);

-- create_collaboration_notifications only inserts for recipients who are
-- actual trip participants, silently dropping any that are not.
select public.create_collaboration_notifications(
  '92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  array['92222222-2222-4222-8222-222222222222', '92333333-3333-4333-8333-333333333333']::uuid[],
  'item_created',
  'Ana adicionou um item',
  'Torre Eiffel',
  '/trips/92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?tab=itinerary'
);

reset role;

-- notifications' own RLS only lets a user read their own rows, so
-- verifying delivery means reading back as the recipient, not the actor.
set local role authenticated;
set local request.jwt.claim.sub = '92222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"92222222-2222-4222-8222-222222222222","email":"traveler@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.notifications where trip_id = '92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'the traveler received exactly one notification (the outsider was never a recipient)'
);

select is(
  (select user_id from public.notifications where trip_id = '92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' limit 1),
  '92222222-2222-4222-8222-222222222222'::uuid,
  'the notification is addressed to the traveler'
);

-- get_trip_participant_emails resolves emails (and the email preference)
-- only for genuine trip participants.
select results_eq(
  $$
    select user_id, email, collaboration_emails_enabled
    from public.get_trip_participant_emails(
      '92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      array['92222222-2222-4222-8222-222222222222', '92333333-3333-4333-8333-333333333333']::uuid[]
    )
  $$,
  $$values ('92222222-2222-4222-8222-222222222222'::uuid, 'traveler@example.com'::text, true)$$,
  'participant emails resolve, outsiders are silently excluded'
);

reset role;

-- An outsider cannot create notifications on a trip they do not belong to.
set local role authenticated;
set local request.jwt.claim.sub = '92333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"92333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select throws_ok(
  $$
    select public.create_collaboration_notifications(
      '92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      array['92222222-2222-4222-8222-222222222222']::uuid[],
      'item_created',
      'Sneaky',
      'Sneaky',
      '/trips/92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?tab=itinerary'
    )
  $$,
  'P0001',
  'not_authorized',
  'an outsider cannot create collaboration notifications on a trip they do not belong to'
);

-- The events ledger itself is never directly readable, even by a
-- participant - only the security definer RPCs touch it.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '92222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"92222222-2222-4222-8222-222222222222","email":"traveler@example.com","role":"authenticated"}';

-- No grant at all exists for authenticated on this table (only the RPCs,
-- run as security definer, ever touch it), so a direct select is a hard
-- permission error, not merely an RLS-filtered empty result.
select throws_ok(
  $$ select count(*) from public.collaboration_notification_events $$,
  '42501',
  null,
  'the collaboration_notification_events ledger has no direct read access, even for participants'
);

select * from finish();
rollback;
