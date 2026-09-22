begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('99111111-1111-4111-8111-111111111111', 'carla@example.com'),
  ('99222222-2222-4222-8222-222222222222', 'diego@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values
  ('99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Porto', '2027-10-01', '2027-10-10', '99111111-1111-4111-8111-111111111111');

set local role authenticated;
set local request.jwt.claim.sub = '99111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"99111111-1111-4111-8111-111111111111","email":"carla@example.com","role":"authenticated"}';

-- #229: end_time requires a start_time, mirroring the itinerary form.
select throws_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, end_time, created_by)
    values ('99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-10-02', 'Walking tour', '11:00', '99111111-1111-4111-8111-111111111111')
  $$,
  '23514',
  null,
  'an end_time without a start_time is rejected'
);

select lives_ok(
  $$
    insert into public.itinerary_items (id, trip_id, item_date, title, start_time, end_time, created_by)
    values ('99cccccc-cccc-4ccc-8ccc-cccccccccccc', '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-10-02', 'Walking tour', '09:00', '11:00', '99111111-1111-4111-8111-111111111111')
  $$,
  'an end_time alongside a start_time is accepted'
);

select throws_ok(
  $$
    update public.itinerary_items
    set start_time = null
    where id = '99cccccc-cccc-4ccc-8ccc-cccccccccccc'
  $$,
  '23514',
  null,
  'clearing start_time while end_time is still set is rejected'
);

-- approx_distance is free text capped at 100 characters.
select lives_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, approx_distance, created_by)
    values ('99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-10-03', 'Riverside walk', '2.5 km', '99111111-1111-4111-8111-111111111111')
  $$,
  'a short approx_distance value is accepted'
);

select throws_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, approx_distance, created_by)
    values ('99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-10-04', 'Riverside walk', repeat('a', 101), '99111111-1111-4111-8111-111111111111')
  $$,
  '23514',
  null,
  'an approx_distance value over 100 characters is rejected'
);

-- needs_review defaults to false and can be toggled.
select results_eq(
  $$select needs_review from public.itinerary_items where id = '99cccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
  $$values (false)$$,
  'needs_review defaults to false'
);

select lives_ok(
  $$update public.itinerary_items set needs_review = true where id = '99cccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
  'needs_review can be updated'
);

-- prep_item_templates.location is free text capped at 200 characters.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      id, owner_id, title, item_type, category, country, city, classification, location
    ) values (
      '99dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '99111111-1111-4111-8111-111111111111',
      'Visit the Livraria Lello',
      'itinerary_item',
      'experiences',
      'Portugal',
      'Porto',
      'recommended',
      'Rua das Carmelitas 144'
    )
  $$,
  'an itinerary_item template can store its own address'
);

select throws_ok(
  $$
    insert into public.prep_item_templates (
      id, owner_id, title, item_type, category, country, classification, location
    ) values (
      '99eeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '99111111-1111-4111-8111-111111111111',
      'Another spot',
      'itinerary_item',
      'experiences',
      'Portugal',
      'recommended',
      repeat('a', 201)
    )
  $$,
  '23514',
  null,
  'a template location value over 200 characters is rejected'
);

-- #229 (D3): duplicate reusable itinerary templates are prevented per
-- owner by (title, location), not by a per-trip application count anymore.
select throws_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, country, city, classification, location
    ) values (
      '99111111-1111-4111-8111-111111111111',
      '  visit the LIVRARIA lello  ',
      'itinerary_item',
      'experiences',
      'Portugal',
      'Porto',
      'recommended',
      '  rua das carmelitas 144  '
    )
  $$,
  '23505',
  null,
  'the same owner cannot save two itinerary templates with the same title and address, ignoring case and whitespace'
);

-- A different address makes it a distinct template.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, country, city, classification, location
    ) values (
      '99111111-1111-4111-8111-111111111111',
      'Visit the Livraria Lello',
      'itinerary_item',
      'experiences',
      'Portugal',
      'Porto',
      'recommended',
      'A different entrance'
    )
  $$,
  'the same title with a different address is a distinct template'
);

-- A different owner is never blocked by another owner's template.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, country, city, classification, location
    ) values (
      '99222222-2222-4222-8222-222222222222',
      'Visit the Livraria Lello',
      'itinerary_item',
      'experiences',
      'Portugal',
      'Porto',
      'recommended',
      'Rua das Carmelitas 144'
    )
  $$,
  'a different owner can save the same title and address'
);

-- A non-itinerary template type is never restricted by this index.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, continent, country, classification, due_offset_days, location
    ) values
      ('99111111-1111-4111-8111-111111111111', 'Check passport validity', 'preparation', 'documents', 'europe', 'Portugal', 'required', 180, null),
      ('99111111-1111-4111-8111-111111111111', 'Check passport validity', 'preparation', 'documents', 'europe', 'Portugal', 'required', 180, null)
  $$,
  'preparation templates are unaffected by the itinerary_item dedupe index'
);

-- #229 (D3): the same itinerary template can now be applied to the same
-- trip more than once (this used to be blocked by
-- itinerary_items_trip_template_id_unique, removed by this migration).
select lives_ok(
  $$
    insert into public.itinerary_items (trip_id, item_date, title, template_id, created_by)
    values
      ('99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-10-05', 'Visit the Livraria Lello', '99dddddd-dddd-4ddd-8ddd-dddddddddddd', '99111111-1111-4111-8111-111111111111'),
      ('99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-10-06', 'Visit the Livraria Lello', '99dddddd-dddd-4ddd-8ddd-dddddddddddd', '99111111-1111-4111-8111-111111111111')
  $$,
  'the same itinerary template can be applied to the same trip on two different days'
);

select * from finish();
rollback;
