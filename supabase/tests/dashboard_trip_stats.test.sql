begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('94111111-1111-4111-8111-111111111111', 'ana@example.com'),
  ('94222222-2222-4222-8222-222222222222', 'bruno@example.com'),
  ('94333333-3333-4333-8333-333333333333', 'outsider@example.com');

-- Trip with two participants and a mix of critical/regular, done/open tasks.
insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Lisboa',
  '2027-09-01',
  '2027-09-10',
  '94111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  '94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '94222222-2222-4222-8222-222222222222',
  'organizer'
);

insert into public.trip_tasks (trip_id, title, is_critical, completed_at, completed_by, created_by) values
  ('94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Passport', true, now(), '94111111-1111-4111-8111-111111111111', '94111111-1111-4111-8111-111111111111'),
  ('94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', true, null, null, '94111111-1111-4111-8111-111111111111'),
  ('94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Pack bags', false, null, null, '94111111-1111-4111-8111-111111111111');

-- Trip with no tasks at all, only the creator as participant.
insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '94bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Roma',
  '2027-10-01',
  '2027-10-05',
  '94111111-1111-4111-8111-111111111111'
);

set local role authenticated;
set local request.jwt.claim.sub = '94111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"94111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

select results_eq(
  $$
    select readiness_percentage, critical_open_count, participant_count
    from public.get_dashboard_trip_stats()
    where trip_id = '94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  $$values (33, 1::bigint, 2::bigint)$$,
  'readiness rounds 1 of 3 completed tasks, and only the open critical task counts'
);

select results_eq(
  $$
    select readiness_percentage, critical_open_count, participant_count
    from public.get_dashboard_trip_stats()
    where trip_id = '94bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  $$,
  $$values (0, 0::bigint, 1::bigint)$$,
  'a trip with no tasks yet reports 0% readiness instead of dividing by zero'
);

-- An outsider gets no rows back for a trip they do not participate in.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '94333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"94333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.get_dashboard_trip_stats()),
  0::bigint,
  'an outsider sees no stats for trips they do not participate in'
);

select * from finish();
rollback;
