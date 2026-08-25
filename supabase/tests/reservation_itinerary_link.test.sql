begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('96111111-1111-4111-8111-111111111111', 'ana@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values
  ('96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Kyoto', '2027-11-01', '2027-11-10', '96111111-1111-4111-8111-111111111111'),
  ('96bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Osaka', '2027-11-11', '2027-11-15', '96111111-1111-4111-8111-111111111111');

insert into public.itinerary_items (id, trip_id, item_date, title, created_by) values
  ('96cccccc-cccc-4ccc-8ccc-cccccccccccc', '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-11-02', 'Fushimi Inari', '96111111-1111-4111-8111-111111111111'),
  ('96dddddd-dddd-4ddd-8ddd-dddddddddddd', '96bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2027-11-12', 'Osaka Castle', '96111111-1111-4111-8111-111111111111');

set local role authenticated;
set local request.jwt.claim.sub = '96111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"96111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

-- A reservation can be created already linked to an itinerary item in the
-- same trip.
select lives_ok(
  $$
    insert into public.trip_reservations (
      id, trip_id, reservation_type, title, start_date, itinerary_item_id, created_by
    ) values (
      '96eeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'transport',
      'Taxi to Fushimi Inari',
      '2027-11-02',
      '96cccccc-cccc-4ccc-8ccc-cccccccccccc',
      '96111111-1111-4111-8111-111111111111'
    )
  $$,
  'a reservation can be linked to an itinerary item in the same trip'
);

-- Linking to an itinerary item from a *different* trip is rejected.
select throws_ok(
  $$
    insert into public.trip_reservations (
      trip_id, reservation_type, title, start_date, itinerary_item_id, created_by
    ) values (
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'transport',
      'Sneaky cross-trip link',
      '2027-11-02',
      '96dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '96111111-1111-4111-8111-111111111111'
    )
  $$,
  '42501',
  null,
  'a reservation cannot be linked to an itinerary item from another trip'
);

-- The link can be added later via an update.
insert into public.trip_reservations (
  id, trip_id, reservation_type, title, start_date, created_by
) values (
  '96ffffff-ffff-4fff-8fff-ffffffffffff',
  '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'lodging',
  'Ryokan',
  '2027-11-02',
  '96111111-1111-4111-8111-111111111111'
);

select lives_ok(
  $$
    update public.trip_reservations
    set itinerary_item_id = '96cccccc-cccc-4ccc-8ccc-cccccccccccc'
    where id = '96ffffff-ffff-4fff-8fff-ffffffffffff'
  $$,
  'the link can be added to an existing reservation via update'
);

-- Deleting the itinerary item clears the link but keeps the reservation.
delete from public.itinerary_items where id = '96cccccc-cccc-4ccc-8ccc-cccccccccccc';

select results_eq(
  $$
    select title, itinerary_item_id
    from public.trip_reservations
    where id = '96eeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  $$,
  $$values ('Taxi to Fushimi Inari'::text, null::uuid)$$,
  'deleting the linked itinerary item clears the link without deleting the reservation'
);

select * from finish();
rollback;
