begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('98111111-1111-4111-8111-111111111111', 'ana@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values
  ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rome', '2027-05-10', '2027-05-15', '98111111-1111-4111-8111-111111111111'),
  ('98bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Day trip', '2027-06-01', null, '98111111-1111-4111-8111-111111111111');

set local role authenticated;
set local request.jwt.claim.sub = '98111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"98111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

-- An item dated within the trip's range is accepted.
select lives_ok(
  $$
    insert into public.itinerary_items (id, trip_id, item_date, title, created_by)
    values ('98cccccc-cccc-4ccc-8ccc-cccccccccccc', '98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-05-12', 'Colosseum', '98111111-1111-4111-8111-111111111111')
  $$,
  'an item dated within the trip range is accepted'
);

-- An item dated before the trip starts is rejected.
select throws_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, created_by)
    values ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-05-09', 'Too early', '98111111-1111-4111-8111-111111111111')
  $$,
  'P0001',
  'itinerary_item_date_outside_trip_range',
  'an item dated before the trip starts is rejected'
);

-- An item dated after the trip ends is rejected.
select throws_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, created_by)
    values ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-05-16', 'Too late', '98111111-1111-4111-8111-111111111111')
  $$,
  'P0001',
  'itinerary_item_date_outside_trip_range',
  'an item dated after the trip ends is rejected'
);

-- A trip with no end_date only has a single valid day: its start_date.
select lives_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, created_by)
    values ('98bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2027-06-01', 'Only day', '98111111-1111-4111-8111-111111111111')
  $$,
  'an open-ended trip accepts an item on its start_date'
);

select throws_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, created_by)
    values ('98bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2027-06-02', 'Second day', '98111111-1111-4111-8111-111111111111')
  $$,
  'P0001',
  'itinerary_item_date_outside_trip_range',
  'an open-ended trip rejects an item on any day after its start_date'
);

-- Updating an existing item to a date outside the range is rejected too.
select throws_ok(
  $$
    update public.itinerary_items
    set item_date = '2027-05-20'
    where id = '98cccccc-cccc-4ccc-8ccc-cccccccccccc'
  $$,
  'P0001',
  'itinerary_item_date_outside_trip_range',
  'moving an existing item outside the trip range via update is rejected'
);

select * from finish();
rollback;
