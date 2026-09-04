begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('91111111-1111-4111-8111-111111111111', 'organizer@example.com'),
  ('91222222-2222-4222-8222-222222222222', 'traveler@example.com'),
  ('91333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values
  ('91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Lisbon', '2027-09-01', '2027-09-10', '91111111-1111-4111-8111-111111111111'),
  ('91bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Porto', '2027-10-01', '2027-10-05', '91111111-1111-4111-8111-111111111111');

insert into public.trip_participants (trip_id, user_id, role) values
  ('91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '91222222-2222-4222-8222-222222222222', 'traveler');

insert into public.itinerary_items (id, trip_id, item_date, title, created_by) values
  ('91cccccc-cccc-4ccc-8ccc-cccccccccccc', '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027-09-03', 'Fado dinner', '91111111-1111-4111-8111-111111111111'),
  ('91dddddd-dddd-4ddd-8ddd-dddddddddddd', '91bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2027-10-02', 'Douro tour', '91111111-1111-4111-8111-111111111111');

insert into public.prep_item_templates (
  id, owner_id, title, item_type, category, continent, country, classification, due_offset_days, currency, estimated_amount
) values (
  '91eeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '91111111-1111-4111-8111-111111111111',
  'Book travel insurance',
  'preparation',
  'health',
  'europe',
  'Portugal',
  'required',
  30,
  'EUR',
  100.00
);

set local role authenticated;
set local request.jwt.claim.sub = '91111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"91111111-1111-4111-8111-111111111111","email":"organizer@example.com","role":"authenticated"}';

-- Applying a template (an organizer insert copying the template's fields)
-- creates an independent trip_tasks row.
select lives_ok(
  $$
    insert into public.trip_tasks (
      id, trip_id, title, item_type, category, continent, country, classification,
      due_offset_days, due_date, currency, estimated_amount, is_critical, template_id, created_by
    ) values (
      '91f00000-0000-4000-8000-000000000001',
      '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Book travel insurance',
      'preparation',
      'health',
      'europe',
      'Portugal',
      'required',
      30,
      '2027-08-02',
      'EUR',
      100.00,
      true,
      '91eeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '91111111-1111-4111-8111-111111111111'
    )
  $$,
  'an organizer can apply a template to a trip they organize'
);

-- Editing the template afterward does not retroactively change the applied
-- copy.
update public.prep_item_templates
set title = 'Buy travel insurance (renamed)', estimated_amount = 999.00
where id = '91eeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select results_eq(
  $$
    select title, estimated_amount
    from public.trip_tasks
    where id = '91f00000-0000-4000-8000-000000000001'
  $$,
  $$values ('Book travel insurance'::text, 100.00::numeric(14,2))$$,
  'editing the template does not change an already-applied item'
);

-- A document_request item without instructions is rejected.
select throws_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, continent, country, classification,
      due_offset_days, created_by
    ) values (
      '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Provide visa scan',
      'document_request',
      'documents',
      'europe',
      'Portugal',
      'required',
      60,
      '91111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  null,
  'a document request without instructions is rejected'
);

-- A governed item without a continent/country is rejected.
select throws_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, classification, due_offset_days, created_by
    ) values (
      '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Missing location',
      'preparation',
      'other',
      'optional',
      10,
      '91111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  null,
  'a governed item without continent/country is rejected'
);

-- A negative paid_amount is rejected.
select throws_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, continent, country, classification,
      due_offset_days, paid_amount, created_by
    ) values (
      '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Negative paid amount',
      'preparation',
      'other',
      'europe',
      'Portugal',
      'optional',
      10,
      -5.00,
      '91111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  null,
  'a negative paid_amount is rejected'
);

-- Linking to an itinerary item from a *different* trip is rejected.
select throws_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, continent, country, classification,
      due_offset_days, itinerary_item_id, created_by
    ) values (
      '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Sneaky cross-trip link',
      'preparation',
      'other',
      'europe',
      'Portugal',
      'optional',
      10,
      '91dddddd-dddd-4ddd-8ddd-dddddddddddd',
      '91111111-1111-4111-8111-111111111111'
    )
  $$,
  '42501',
  null,
  'a governed item cannot be linked to an itinerary item from another trip'
);

-- Linking to an itinerary item in the *same* trip succeeds.
select lives_ok(
  $$
    insert into public.trip_tasks (
      id, trip_id, title, item_type, category, continent, country, classification,
      due_offset_days, itinerary_item_id, created_by
    ) values (
      '91f00000-0000-4000-8000-000000000002',
      '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Dinner reservation follow-up',
      'preparation',
      'other',
      'europe',
      'Portugal',
      'optional',
      5,
      '91cccccc-cccc-4ccc-8ccc-cccccccccccc',
      '91111111-1111-4111-8111-111111111111'
    )
  $$,
  'a governed item can be linked to an itinerary item in the same trip'
);

-- A completed item with both amounts filled in gets exactly one linked
-- expense when completed, and completing it again does not duplicate it.
insert into public.trip_tasks (
  id, trip_id, title, item_type, category, continent, country, classification,
  due_offset_days, currency, estimated_amount, paid_amount, created_by
) values (
  '91f00000-0000-4000-8000-000000000003',
  '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Airport transfer',
  'preparation',
  'transport',
  'europe',
  'Portugal',
  'optional',
  1,
  'EUR',
  40.00,
  35.00,
  '91111111-1111-4111-8111-111111111111'
);

select lives_ok(
  $$select public.complete_prep_item('91f00000-0000-4000-8000-000000000003', true)$$,
  'the organizer can complete a priced item'
);

select is(
  (select count(*) from public.trip_expenses where description = 'Airport transfer'),
  1::bigint,
  'completing the item created exactly one linked expense'
);

select isnt(
  (select expense_id from public.trip_tasks where id = '91f00000-0000-4000-8000-000000000003'),
  null,
  'the task stores the linked expense id'
);

select lives_ok(
  $$select public.complete_prep_item('91f00000-0000-4000-8000-000000000003', true)$$,
  'completing an already-completed item again does not error'
);

select is(
  (select count(*) from public.trip_expenses where description = 'Airport transfer'),
  1::bigint,
  'retrying completion does not duplicate the expense'
);

-- Reopening deletes the linked expense - no orphan is left behind.
select lives_ok(
  $$select public.complete_prep_item('91f00000-0000-4000-8000-000000000003', false)$$,
  'the item can be reopened'
);

select is(
  (select count(*) from public.trip_expenses where description = 'Airport transfer'),
  0::bigint,
  'reopening the item deleted its linked expense'
);

select is(
  (select expense_id from public.trip_tasks where id = '91f00000-0000-4000-8000-000000000003'),
  null,
  'the task no longer references the deleted expense'
);

-- Deleting a task with a linked expense deletes the expense too.
select public.complete_prep_item('91f00000-0000-4000-8000-000000000003', true);

select is(
  (select count(*) from public.trip_expenses where description = 'Airport transfer'),
  1::bigint,
  'the item is completed again with a fresh linked expense'
);

select lives_ok(
  $$delete from public.trip_tasks where id = '91f00000-0000-4000-8000-000000000003'$$,
  'the organizer can delete a completed item'
);

select is(
  (select count(*) from public.trip_expenses where description = 'Airport transfer'),
  0::bigint,
  'deleting the task also deleted its linked expense'
);

-- Changing the trip's start_date recalculates open items and preserves
-- completed ones.
insert into public.trip_tasks (
  id, trip_id, title, item_type, category, continent, country, classification,
  due_offset_days, due_date, created_by
) values (
  '91f00000-0000-4000-8000-000000000004',
  '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Open item',
  'preparation',
  'other',
  'europe',
  'Portugal',
  'optional',
  10,
  '2027-08-22',
  '91111111-1111-4111-8111-111111111111'
),
(
  '91f00000-0000-4000-8000-000000000005',
  '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Completed item',
  'preparation',
  'other',
  'europe',
  'Portugal',
  'optional',
  10,
  '2027-08-22',
  '91111111-1111-4111-8111-111111111111'
);

select public.complete_prep_item('91f00000-0000-4000-8000-000000000005', true);

update public.trips set start_date = '2027-09-06' where id = '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select due_date from public.trip_tasks where id = '91f00000-0000-4000-8000-000000000004'),
  '2027-08-27'::date,
  'an open item due_date is recalculated when the trip start_date changes'
);

select is(
  (select due_date from public.trip_tasks where id = '91f00000-0000-4000-8000-000000000005'),
  '2027-08-22'::date,
  'a completed item keeps its original due_date audit'
);

reset role;

-- A non-organizer participant cannot create or edit the definition of a
-- governed item, but can complete one.
set local role authenticated;
set local request.jwt.claim.sub = '91222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"91222222-2222-4222-8222-222222222222","email":"traveler@example.com","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, continent, country, classification,
      due_offset_days, created_by
    ) values (
      '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Traveler-created governed item',
      'preparation',
      'other',
      'europe',
      'Portugal',
      'optional',
      10,
      '91222222-2222-4222-8222-222222222222'
    )
  $$,
  '42501',
  null,
  'a non-organizer participant cannot apply/create a governed item'
);

select throws_ok(
  $$
    update public.trip_tasks
    set title = 'Hijacked title'
    where id = '91f00000-0000-4000-8000-000000000004'
  $$,
  '42501',
  null,
  'a non-organizer participant cannot edit the definition of a governed item'
);

select lives_ok(
  $$select public.complete_prep_item('91f00000-0000-4000-8000-000000000004', true)$$,
  'a non-organizer participant (authorized traveler) can complete a governed item'
);

reset role;

-- An outsider cannot see the trip's items and cannot complete them either.
set local role authenticated;
set local request.jwt.claim.sub = '91333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"91333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.trip_tasks where trip_id = '91aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'an outsider cannot see any of this trip preparation items'
);

select throws_ok(
  $$select public.complete_prep_item('91f00000-0000-4000-8000-000000000004', false)$$,
  'P0001',
  'not_authorized',
  'an outsider cannot complete or reopen an item on a trip they do not belong to'
);

select * from finish();
rollback;
