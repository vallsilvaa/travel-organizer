begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('98111111-1111-4111-8111-111111111111', 'ana@example.com'),
  ('98222222-2222-4222-8222-222222222222', 'bruno@example.com'),
  ('98333333-3333-4333-8333-333333333333', 'carla@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Kyoto',
  '2027-11-01',
  '2027-11-10',
  '98111111-1111-4111-8111-111111111111'
);

insert into public.itinerary_items (id, trip_id, item_date, title, location, notes, created_by) values (
  '98bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '2027-11-02',
  'Fushimi Inari',
  'Kyoto',
  'Private note: bring cash for the vending machines',
  '98111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values
  ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '98222222-2222-4222-8222-222222222222', 'organizer'),
  ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '98333333-3333-4333-8333-333333333333', 'traveler');

-- The creator can create a share link.
set local role authenticated;
set local request.jwt.claim.sub = '98111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"98111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.trip_share_links (trip_id, token, created_by)
    values ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'valid-token-abc123', '98111111-1111-4111-8111-111111111111')
  $$,
  'the trip creator can create a share link'
);

-- A plain traveler cannot create one.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '98333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"98333333-3333-4333-8333-333333333333","email":"carla@example.com","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.trip_share_links (trip_id, token, created_by)
    values ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sneaky-token', '98333333-3333-4333-8333-333333333333')
  $$,
  '42501',
  null,
  'a plain traveler cannot create a share link'
);

select is(
  (select count(*)::int from public.trip_share_links),
  0,
  'RLS hides the creator''s share link from a plain traveler'
);

-- A signed-out visitor cannot read trip_share_links directly.
reset role;
set local role anon;

select throws_ok(
  $$select * from public.trip_share_links$$,
  '42501',
  null,
  'a signed-out visitor cannot query trip_share_links directly'
);

-- ...but CAN resolve the trip and its itinerary through the token RPCs.
select results_eq(
  $$select destination from public.get_trip_by_share_token('valid-token-abc123')$$,
  $$values ('Kyoto'::text)$$,
  'the share-token RPC resolves the trip for a signed-out visitor'
);

select results_eq(
  $$select title, location from public.get_trip_itinerary_by_share_token('valid-token-abc123')$$,
  $$values ('Fushimi Inari'::text, 'Kyoto'::text)$$,
  'the share-token RPC resolves the itinerary skeleton for a signed-out visitor'
);

select is(
  (select count(*)::int from public.get_trip_by_share_token('not-a-real-token')),
  0,
  'an invalid token resolves nothing'
);

-- An organizer (not just the creator) can revoke the link.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '98222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"98222222-2222-4222-8222-222222222222","email":"bruno@example.com","role":"authenticated"}';

select lives_ok(
  $$
    update public.trip_share_links
    set revoked_at = now()
    where trip_id = '98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'an organizer (not the creator) can revoke the trip''s share link'
);

-- Once revoked, the token no longer resolves anything for a visitor.
reset role;
set local role anon;

select is(
  (select count(*)::int from public.get_trip_by_share_token('valid-token-abc123')),
  0,
  'a revoked token no longer resolves the trip'
);

select is(
  (select count(*)::int from public.get_trip_itinerary_by_share_token('valid-token-abc123')),
  0,
  'a revoked token no longer resolves the itinerary'
);

select * from finish();
rollback;
