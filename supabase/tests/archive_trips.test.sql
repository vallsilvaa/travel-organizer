begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('a2222222-2222-4222-8222-222222222222', 'organizer@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
  'Kyoto',
  '2027-09-01',
  '2027-09-10',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
  'a2222222-2222-4222-8222-222222222222',
  'organizer'
);

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

-- The creator can archive their own trip.
select results_eq(
  $$
    update public.trips set archived_at = now()
    where id = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'
    returning archived_at is not null
  $$,
  $$values (true)$$,
  'the creator can archive their trip'
);

-- Historical data remains readable while archived.
select is(
  (select destination from public.trips where id = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'),
  'Kyoto',
  'an archived trip is still readable'
);

-- Planning content cannot be created while archived.
select throws_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, created_by)
    values ('aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', '2027-09-02', 'Sneaky item', 'a1111111-1111-4111-8111-111111111111')
  $$,
  '42501',
  null,
  'itinerary items cannot be added to an archived trip'
);

select throws_ok(
  $$
    insert into public.trip_tasks (trip_id, title, created_by)
    values ('aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', 'Sneaky task', 'a1111111-1111-4111-8111-111111111111')
  $$,
  '42501',
  null,
  'tasks cannot be added to an archived trip'
);

select throws_ok(
  $$
    select public.create_expense_with_shares(
      'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
      'Sneaky expense',
      10.00,
      'JPY',
      'food',
      '2027-09-02',
      'a1111111-1111-4111-8111-111111111111',
      '[]'::jsonb
    )
  $$,
  'P0001',
  'trip_archived',
  'expenses cannot be created on an archived trip'
);

-- The creator can restore the trip, which unlocks planning changes again.
select results_eq(
  $$
    update public.trips set archived_at = null
    where id = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'
    returning archived_at
  $$,
  $$values (null::timestamptz)$$,
  'the creator can restore an archived trip'
);

select lives_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, created_by)
    values ('aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa', '2027-09-02', 'Museum', 'a1111111-1111-4111-8111-111111111111')
  $$,
  'itinerary items can be added again once restored'
);

select * from finish();
rollback;
