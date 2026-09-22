begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('98111111-1111-4111-8111-111111111111', 'bea@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values
  ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rome', '2027-09-01', '2027-09-10', '98111111-1111-4111-8111-111111111111'),
  ('98bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Milan', '2027-09-11', '2027-09-15', '98111111-1111-4111-8111-111111111111');

insert into public.prep_item_templates (
  id, owner_id, title, item_type, category, country, city, classification, action
) values (
  '98dddddd-dddd-4ddd-8ddd-dddddddddddd',
  '98111111-1111-4111-8111-111111111111',
  'Visit the Colosseum',
  'itinerary_item',
  'experiences',
  'Italy',
  'Rome',
  'recommended',
  'Check-in'
);

set local role authenticated;
set local request.jwt.claim.sub = '98111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"98111111-1111-4111-8111-111111111111","email":"bea@example.com","role":"authenticated"}';

-- #222: applying an itinerary_item template to a trip works, and its free-text
-- action carries over (Check-in/Check-out and beyond).
select lives_ok(
  $$
    insert into public.itinerary_items (
      id, trip_id, item_date, title, city, action, template_id, created_by
    ) values (
      '98cccccc-cccc-4ccc-8ccc-cccccccccccc',
      '98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2027-09-02',
      'Visit the Colosseum',
      'Rome',
      'Check-in',
      '98dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '98111111-1111-4111-8111-111111111111'
    )
  $$,
  'applying an itinerary_item template to a trip succeeds the first time, action included'
);

-- #229 (D3): applying the same template to the same trip a second time now
-- succeeds - itinerary_items_trip_template_id_unique was removed so the
-- same reusable itinerary template can be used on multiple days of the
-- same trip (duplicate *templates* are prevented at the catalog level
-- instead, see itinerary_end_time_distance_review.test.sql).
select lives_ok(
  $$
    insert into public.itinerary_items (
      trip_id, item_date, title, city, template_id, created_by
    ) values (
      '98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2027-09-03',
      'Visit the Colosseum (again)',
      'Rome',
      '98dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '98111111-1111-4111-8111-111111111111'
    )
  $$,
  'the same itinerary template can now be applied twice to the same trip (#229)'
);

-- The same template can still be applied to a *different* trip.
select lives_ok(
  $$
    insert into public.itinerary_items (
      trip_id, item_date, title, city, template_id, created_by
    ) values (
      '98bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '2027-09-12',
      'Visit the Colosseum',
      'Rome',
      '98dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '98111111-1111-4111-8111-111111111111'
    )
  $$,
  'the same itinerary template can be applied to a different trip'
);

-- Ad-hoc itinerary items (no template_id) never collide with each other.
select lives_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, created_by)
    values
      ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-09-04', 'Free afternoon', '98111111-1111-4111-8111-111111111111'),
      ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-09-05', 'Free afternoon', '98111111-1111-4111-8111-111111111111')
  $$,
  'ad-hoc itinerary items with no template_id never collide, even with an identical title'
);

-- The itinerary action field is free text with a length cap, not a fixed enum.
select lives_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, action, created_by)
    values ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-09-06', 'Hotel Le Meurice', 'Check-out', '98111111-1111-4111-8111-111111111111')
  $$,
  'a short free-text action value is accepted on an itinerary item'
);

select throws_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, action, created_by)
    values ('98aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-09-07', 'Hotel Le Meurice', repeat('a', 51), '98111111-1111-4111-8111-111111111111')
  $$,
  '23514',
  null,
  'an action value over 50 characters is rejected on an itinerary item'
);

select * from finish();
rollback;
