begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('97111111-1111-4111-8111-111111111111', 'ana@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values
  ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Lisbon', '2027-09-01', '2027-09-10', '97111111-1111-4111-8111-111111111111'),
  ('97bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Porto', '2027-09-11', '2027-09-15', '97111111-1111-4111-8111-111111111111');

insert into public.prep_item_templates (
  id, owner_id, title, item_type, category, continent, country, classification, due_offset_days
) values (
  '97dddddd-dddd-4ddd-8ddd-dddddddddddd',
  '97111111-1111-4111-8111-111111111111',
  'Check passport validity',
  'preparation',
  'documents',
  'europe',
  'Portugal',
  'required',
  180
);

set local role authenticated;
set local request.jwt.claim.sub = '97111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"97111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

-- Applying a template once succeeds.
select lives_ok(
  $$
    insert into public.trip_tasks (
      id, trip_id, title, item_type, category, continent, country, classification, template_id, created_by
    ) values (
      '97cccccc-cccc-4ccc-8ccc-cccccccccccc',
      '97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Check passport validity',
      'preparation',
      'documents',
      'europe',
      'Portugal',
      'required',
      '97dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '97111111-1111-4111-8111-111111111111'
    )
  $$,
  'applying a template to a trip succeeds the first time'
);

-- Applying the same template to the same trip a second time is rejected at
-- the database level (#171), even if the UI check were somehow bypassed.
select throws_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, continent, country, classification, template_id, created_by
    ) values (
      '97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Check passport validity (again)',
      'preparation',
      'documents',
      'europe',
      'Portugal',
      'required',
      '97dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '97111111-1111-4111-8111-111111111111'
    )
  $$,
  '23505',
  null,
  'the same template cannot be applied twice to the same trip'
);

-- The same template can still be applied to a *different* trip.
select lives_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, continent, country, classification, template_id, created_by
    ) values (
      '97bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'Check passport validity',
      'preparation',
      'documents',
      'europe',
      'Portugal',
      'required',
      '97dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '97111111-1111-4111-8111-111111111111'
    )
  $$,
  'the same template can be applied to a different trip'
);

-- Ad-hoc tasks (no template_id) never collide with each other.
select lives_ok(
  $$
    insert into public.trip_tasks (trip_id, title, item_type, category, created_by)
    values
      ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Buy sunscreen', 'preparation', 'other', '97111111-1111-4111-8111-111111111111'),
      ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Buy sunscreen', 'preparation', 'other', '97111111-1111-4111-8111-111111111111')
  $$,
  'ad-hoc tasks with no template_id never collide, even with an identical title'
);

-- Removing the applied copy frees the template to be re-added (#171) -
-- the partial unique index only sees currently-existing rows.
delete from public.trip_tasks where id = '97cccccc-cccc-4ccc-8ccc-cccccccccccc';

select lives_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, continent, country, classification, template_id, created_by
    ) values (
      '97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Check passport validity',
      'preparation',
      'documents',
      'europe',
      'Portugal',
      'required',
      '97dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '97111111-1111-4111-8111-111111111111'
    )
  $$,
  'removing the applied copy frees the template for re-adding to the same trip'
);

select * from finish();
rollback;
