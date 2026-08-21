begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('a2222222-2222-4222-8222-222222222222', 'organizer@example.com'),
  ('a3333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa',
  'Lisbon',
  '2027-10-01',
  '2027-10-10',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa',
  'a2222222-2222-4222-8222-222222222222',
  'organizer'
);

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

-- The trip creator can add a flight reservation.
select lives_ok(
  $$
    insert into public.trip_reservations (
      trip_id, reservation_type, title, provider, confirmation_code,
      start_date, start_time, end_date, end_time, location, destination_location, created_by
    ) values (
      'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa', 'flight', 'Outbound flight', 'LATAM', 'ABC123',
      '2027-10-01', '08:00', '2027-10-01', '18:00', 'GRU', 'LIS', 'a1111111-1111-4111-8111-111111111111'
    )
  $$,
  'a trip participant can create a flight reservation'
);

select isnt_empty(
  $$select id from public.trip_reservations where trip_id = 'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'the reservation is visible to its creator'
);

-- A fellow participant can also see and add reservations.
set local request.jwt.claim.sub = 'a2222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select isnt_empty(
  $$select id from public.trip_reservations where trip_id = 'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'a fellow participant can view the reservation'
);

select lives_ok(
  $$
    insert into public.trip_reservations (trip_id, reservation_type, title, start_date, created_by)
    values ('aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa', 'lodging', 'Hotel Baixa', '2027-10-01', 'a2222222-2222-4222-8222-222222222222')
  $$,
  'a fellow participant can create a lodging reservation'
);

select throws_ok(
  $$
    insert into public.trip_reservations (trip_id, reservation_type, title, start_date, created_by)
    values ('aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa', 'lodging', 'Sneaky reservation', '2027-10-01', 'a1111111-1111-4111-8111-111111111111')
  $$,
  '42501',
  null,
  'a participant cannot create a reservation impersonating another created_by'
);

select throws_ok(
  $$
    insert into public.trip_reservations (trip_id, reservation_type, title, start_date, created_by)
    values ('aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa', 'road-trip', 'Bad type', '2027-10-01', 'a2222222-2222-4222-8222-222222222222')
  $$,
  '23514',
  null,
  'an unsupported reservation_type is rejected by the check constraint'
);

-- An outsider (not a participant) cannot see or create reservations.
set local request.jwt.claim.sub = 'a3333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"a3333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select is_empty(
  $$select id from public.trip_reservations where trip_id = 'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'an outsider cannot see any reservations for the trip'
);

select throws_ok(
  $$
    insert into public.trip_reservations (trip_id, reservation_type, title, start_date, created_by)
    values ('aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa', 'transport', 'Sneaky transport', '2027-10-01', 'a3333333-3333-4333-8333-333333333333')
  $$,
  '42501',
  null,
  'an outsider cannot create a reservation for the trip'
);

-- Archiving the trip freezes reservation writes but keeps them readable.
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

update public.trips set archived_at = now() where id = 'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa';

select isnt_empty(
  $$select id from public.trip_reservations where trip_id = 'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'reservations remain readable on an archived trip'
);

select throws_ok(
  $$
    insert into public.trip_reservations (trip_id, reservation_type, title, start_date, created_by)
    values ('aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa', 'flight', 'Sneaky flight', '2027-10-02', 'a1111111-1111-4111-8111-111111111111')
  $$,
  '42501',
  null,
  'reservations cannot be added to an archived trip'
);

select throws_ok(
  $$
    update public.trip_reservations
    set title = 'Renamed'
    where trip_id = 'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  '42501',
  null,
  'reservations cannot be edited on an archived trip'
);

-- DELETE policies only have a USING clause, so a non-matching row is
-- silently excluded rather than raising an error (unlike UPDATE's
-- WITH CHECK) - assert the row count is unaffected instead of throws_ok.
select results_eq(
  $$
    with attempt as (
      delete from public.trip_reservations
      where trip_id = 'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaaaaaa'
      returning id
    )
    select count(*) from attempt
  $$,
  $$values (0::bigint)$$,
  'reservations cannot be deleted on an archived trip'
);

select * from finish();
rollback;
