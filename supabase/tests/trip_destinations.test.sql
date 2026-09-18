begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('d1111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('d2222222-2222-4222-8222-222222222222', 'organizer@example.com'),
  ('d3333333-3333-4333-8333-333333333333', 'traveler@example.com'),
  ('d4444444-4444-4444-8444-444444444444', 'outsider@example.com');

insert into public.trips (id, title, destination, start_date, end_date, created_by) values (
  'daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
  'Partiu Portugal',
  'Lisboa, Portugal',
  '2027-11-01',
  '2027-11-10',
  'd1111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values
  ('daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'd2222222-2222-4222-8222-222222222222', 'organizer'),
  ('daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'd3333333-3333-4333-8333-333333333333', 'traveler');

set local role authenticated;
set local request.jwt.claim.sub = 'd1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

-- The trip creator (always an organizer) can add a city-level destination.
select lives_ok(
  $$
    insert into public.trip_destinations (trip_id, label, city, country, continent, granularity, position)
    values (
      'daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
      'Lisboa, Portugal', 'Lisboa', 'Portugal', 'europe', 'city', 0
    )
  $$,
  'the trip creator can add a city destination'
);

-- A country-level destination (no city picked) is also valid.
select lives_ok(
  $$
    insert into public.trip_destinations (trip_id, label, country, granularity, position)
    values ('daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'Espanha', 'Espanha', 'country', 1)
  $$,
  'the trip creator can add a country-only destination'
);

select throws_ok(
  $$
    insert into public.trip_destinations (trip_id, label, country, granularity, position)
    values ('daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'France', 'France', 'city', 2)
  $$,
  '23514',
  null,
  'a city destination without a city name is rejected'
);

select throws_ok(
  $$
    insert into public.trip_destinations (trip_id, label, city, country, granularity, position)
    values ('daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'Porto, Portugal', 'Porto', 'Portugal', 'country', 3)
  $$,
  '23514',
  null,
  'a country destination cannot carry a city name'
);

-- A fellow organizer-role participant can also manage destinations.
set local request.jwt.claim.sub = 'd2222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"d2222222-2222-4222-8222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.trip_destinations (trip_id, label, city, country, continent, granularity, position)
    values (
      'daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
      'Porto, Portugal', 'Porto', 'Portugal', 'europe', 'city', 2
    )
  $$,
  'a fellow organizer-role participant can add a destination'
);

-- A plain traveler can see the destinations but not write them.
set local request.jwt.claim.sub = 'd3333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"d3333333-3333-4333-8333-333333333333","email":"traveler@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.trip_destinations where trip_id = 'daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa')::int,
  3,
  'a traveler participant can view every destination'
);

select throws_ok(
  $$
    insert into public.trip_destinations (trip_id, label, country, granularity, position)
    values ('daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'Marrocos', 'Marrocos', 'country', 3)
  $$,
  '42501',
  null,
  'a plain traveler cannot add a destination'
);

-- An outsider (not a participant at all) sees and can change nothing.
set local request.jwt.claim.sub = 'd4444444-4444-4444-8444-444444444444';
set local request.jwt.claims = '{"sub":"d4444444-4444-4444-8444-444444444444","email":"outsider@example.com","role":"authenticated"}';

select is_empty(
  $$select id from public.trip_destinations where trip_id = 'daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'an outsider cannot see any destination for the trip'
);

select throws_ok(
  $$
    insert into public.trip_destinations (trip_id, label, country, granularity, position)
    values ('daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'Marrocos', 'Marrocos', 'country', 3)
  $$,
  '42501',
  null,
  'an outsider cannot add a destination'
);

-- Archiving the trip freezes destinations, same as other planning content.
set local request.jwt.claim.sub = 'd1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

update public.trips set archived_at = now() where id = 'daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa';

select isnt_empty(
  $$select id from public.trip_destinations where trip_id = 'daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'destinations remain readable on an archived trip'
);

select throws_ok(
  $$
    insert into public.trip_destinations (trip_id, label, country, granularity, position)
    values ('daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'Marrocos', 'Marrocos', 'country', 3)
  $$,
  '42501',
  null,
  'destinations cannot be added on an archived trip'
);

-- DELETE policies only have a USING clause, so a non-matching row is
-- silently excluded rather than raising an error (unlike INSERT's
-- WITH CHECK) - assert the row count is unaffected instead of throws_ok.
select results_eq(
  $$
    with attempt as (
      delete from public.trip_destinations
      where trip_id = 'daaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa' and label = 'Espanha'
      returning id
    )
    select count(*) from attempt
  $$,
  $$values (0::bigint)$$,
  'destinations cannot be removed from an archived trip'
);

select * from finish();
rollback;
