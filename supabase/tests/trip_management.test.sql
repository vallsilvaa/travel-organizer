begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('51111111-1111-4111-8111-111111111111', 'trip-owner@example.com'),
  ('52222222-2222-4222-8222-222222222222', 'trip-organizer@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Londres',
  '2027-04-01',
  '2027-04-10',
  '51111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '52222222-2222-4222-8222-222222222222',
  'organizer'
);

insert into public.itinerary_items (id, trip_id, item_date, title, created_by) values (
  '5bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '2027-04-02',
  'Museu',
  '51111111-1111-4111-8111-111111111111'
);

insert into public.trip_tasks (id, trip_id, title, owner_id, created_by) values (
  '5ccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Conferir documentos',
  '51111111-1111-4111-8111-111111111111',
  '51111111-1111-4111-8111-111111111111'
);

insert into public.item_comments (
  id, trip_id, item_type, task_id, body, author_id
) values (
  '5ddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'task',
  '5ccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Comentário',
  '51111111-1111-4111-8111-111111111111'
);

insert into public.trip_expenses (
  id, trip_id, description, amount, currency, category, expense_date, payer_id, created_by
) values (
  '5eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Hotel',
  500,
  'GBP',
  'lodging',
  '2027-04-01',
  '51111111-1111-4111-8111-111111111111',
  '51111111-1111-4111-8111-111111111111'
);

insert into public.trip_invitations (
  id, trip_id, trip_destination, email, invited_by
) values (
  '5fffffff-ffff-4fff-8fff-ffffffffffff',
  '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Londres',
  'guest@example.com',
  '51111111-1111-4111-8111-111111111111'
);

insert into public.task_reminder_deliveries (id, task_id, owner_id, due_date) values (
  '50000000-0000-4000-8000-000000000001',
  '5ccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '51111111-1111-4111-8111-111111111111',
  '2027-03-20'
);

set local role authenticated;
set local request.jwt.claim.sub = '52222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"52222222-2222-4222-8222-222222222222","email":"trip-organizer@example.com","role":"authenticated"}';

select lives_ok(
  $$update public.trips set destination = 'Paris' where id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'an organizer update is safely ignored by RLS'
);
select lives_ok(
  $$delete from public.trips where id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'an organizer deletion is safely ignored by RLS'
);

reset role;
select is(
  (select destination from public.trips where id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Londres',
  'another participant cannot edit the trip'
);
select is(
  (select count(*) from public.trips where id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'another participant cannot delete the trip'
);

set local role authenticated;
set local request.jwt.claim.sub = '51111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"51111111-1111-4111-8111-111111111111","email":"trip-owner@example.com","role":"authenticated"}';

select throws_ok(
  $$update public.trips set end_date = '2027-03-31' where id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514',
  null,
  'the database rejects an end date before the start date'
);

select results_eq(
  $$
    update public.trips
    set destination = 'Edimburgo', start_date = '2027-04-02', end_date = '2027-04-11'
    where id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    returning destination
  $$,
  $$values ('Edimburgo'::text)$$,
  'the creator can edit destination and dates'
);

select results_eq(
  $$delete from public.trips where id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id$$,
  $$values ('5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'the creator can delete the trip'
);

reset role;
select is((select count(*) from public.trip_participants where trip_id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'participants are removed with the trip');
select is((select count(*) from public.itinerary_items where trip_id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'itinerary items are removed with the trip');
select is((select count(*) from public.trip_tasks where trip_id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'tasks are removed with the trip');
select is((select count(*) from public.item_comments where trip_id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'comments are removed with the trip');
select is((select count(*) from public.trip_expenses where trip_id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'expenses are removed with the trip');
select is((select count(*) from public.trip_invitations where trip_id = '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'invitations are removed with the trip');
select is((select count(*) from public.task_reminder_deliveries where id = '50000000-0000-4000-8000-000000000001'), 0::bigint, 'task reminders are removed through the task cascade');

select * from finish();
rollback;
