begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('61111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('62222222-2222-4222-8222-222222222222', 'organizer@example.com'),
  ('63333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Lisboa',
  '2027-05-01',
  '2027-05-10',
  '61111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '62222222-2222-4222-8222-222222222222',
  'organizer'
);

-- An outsider (not a participant) cannot remove anyone.
set local role authenticated;
set local request.jwt.claim.sub = '63333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"63333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select lives_ok(
  $$delete from public.trip_participants where trip_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '62222222-2222-4222-8222-222222222222'$$,
  'an outsider delete is safely ignored by RLS'
);

reset role;
select is(
  (select count(*) from public.trip_participants where trip_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '62222222-2222-4222-8222-222222222222'),
  1::bigint,
  'the organizer is still a participant after an outsider tries to remove them'
);

-- The organizer cannot remove themselves or the creator.
set local role authenticated;
set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"62222222-2222-4222-8222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select lives_ok(
  $$delete from public.trip_participants where trip_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '61111111-1111-4111-8111-111111111111'$$,
  'an organizer cannot remove the trip creator'
);
select lives_ok(
  $$delete from public.trip_participants where trip_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '62222222-2222-4222-8222-222222222222'$$,
  'an organizer cannot remove themselves'
);

reset role;
select is(
  (select count(*) from public.trip_participants where trip_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  2::bigint,
  'both the creator and the organizer are still participants'
);

-- The trip creator can remove the organizer, but not their own required access.
set local role authenticated;
set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"61111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

select lives_ok(
  $$delete from public.trip_participants where trip_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '61111111-1111-4111-8111-111111111111'$$,
  'the creator cannot remove their own required access'
);

select results_eq(
  $$delete from public.trip_participants where trip_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id = '62222222-2222-4222-8222-222222222222' returning user_id$$,
  $$values ('62222222-2222-4222-8222-222222222222'::uuid)$$,
  'the creator can remove an organizer'
);

reset role;
select is(
  (select count(*) from public.trip_participants where trip_id = '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'only the creator remains a participant'
);
select is(
  (select private.is_trip_participant('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '62222222-2222-4222-8222-222222222222')),
  false,
  'the removed organizer immediately loses trip membership'
);

select * from finish();
rollback;
