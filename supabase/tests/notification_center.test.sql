begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('a2222222-2222-4222-8222-222222222222', 'organizer@example.com'),
  ('a3333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa',
  'Cairo',
  '2027-12-01',
  '2027-12-10',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa',
  'a2222222-2222-4222-8222-222222222222',
  'organizer'
);

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

-- Inviting a registered user notifies them (trigger inserts bypass RLS, so
-- this succeeds regardless of who is currently authenticated).
insert into public.trip_invitations (trip_id, trip_destination, email, invited_by)
values (
  'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa', 'Cairo', 'organizer@example.com',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.trip_invitations (trip_id, trip_destination, email, invited_by)
values (
  'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa', 'Cairo', 'ghost@example.com',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.trip_tasks (id, trip_id, title, owner_id, created_by)
values (
  'bbbbbbbb-1111-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa',
  'Book the museum tour', 'a2222222-2222-4222-8222-222222222222',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.trip_tasks (id, trip_id, title, owner_id, created_by)
values (
  'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa',
  'Self task', 'a1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111'
);

-- Notifications are only visible to their own recipient, per RLS - switch
-- to the organizer to read what they should have received.
set local request.jwt.claim.sub = 'a2222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select results_eq(
  $$
    select notification_type, link_path from public.notifications
    where user_id = 'a2222222-2222-4222-8222-222222222222' and notification_type = 'invitation'
  $$,
  $$values ('invitation'::text, '/dashboard'::text)$$,
  'inviting a registered user creates exactly one invitation notification for them'
);

select results_eq(
  $$
    select notification_type, link_path from public.notifications
    where user_id = 'a2222222-2222-4222-8222-222222222222' and notification_type = 'task_assigned'
  $$,
  $$values ('task_assigned'::text, ('/trips/aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa?tab=preparation')::text)$$,
  'assigning a task to a fellow participant notifies them'
);

-- Commenting on someone else's item notifies the item's creator.
insert into public.item_comments (trip_id, item_type, task_id, body, author_id)
values (
  'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa', 'task', 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb',
  'Should we book in advance?', 'a2222222-2222-4222-8222-222222222222'
);

-- Commenting on your own item does not notify yourself.
insert into public.trip_tasks (id, trip_id, title, created_by)
values (
  'bbbbbbbb-3333-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa',
  'Organizer own task', 'a2222222-2222-4222-8222-222222222222'
);

insert into public.item_comments (trip_id, item_type, task_id, body, author_id)
values (
  'aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa', 'task', 'bbbbbbbb-3333-4bbb-8bbb-bbbbbbbbbbbb',
  'Noting this myself', 'a2222222-2222-4222-8222-222222222222'
);

select is_empty(
  $$select id from public.notifications where notification_type = 'comment' and user_id = 'a2222222-2222-4222-8222-222222222222'$$,
  'commenting on your own task does not notify yourself'
);

-- Switch back to the creator to read the comment notification they earned.
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

select results_eq(
  $$
    select notification_type, link_path from public.notifications
    where user_id = 'a1111111-1111-4111-8111-111111111111' and notification_type = 'comment'
  $$,
  $$values ('comment'::text, ('/trips/aaaaaaaa-4444-4aaa-8aaa-aaaaaaaaaaaa?tab=preparation')::text)$$,
  'commenting on a task notifies the task creator'
);

select is_empty(
  $$select id from public.notifications where notification_type = 'task_assigned' and user_id = 'a1111111-1111-4111-8111-111111111111'$$,
  'self-assigning a task does not notify the assigner'
);

-- An outsider cannot see anyone else's notifications.
set local request.jwt.claim.sub = 'a3333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"a3333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select is_empty(
  $$select id from public.notifications where user_id = 'a2222222-2222-4222-8222-222222222222'$$,
  'a different user cannot see someone else notifications'
);

select is_empty(
  $$select id from public.notifications where user_id = 'a1111111-1111-4111-8111-111111111111'$$,
  'an outsider has no notifications of their own for this trip'
);

-- A recipient can mark their own notification read, but not someone else's.
set local request.jwt.claim.sub = 'a2222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select lives_ok(
  $$
    update public.notifications set read_at = now()
    where user_id = 'a2222222-2222-4222-8222-222222222222' and notification_type = 'invitation'
  $$,
  'a recipient can mark their own notification as read'
);

select results_eq(
  $$
    with attempt as (
      update public.notifications set read_at = now()
      where user_id = 'a1111111-1111-4111-8111-111111111111'
      returning id
    )
    select count(*) from attempt
  $$,
  $$values (0::bigint)$$,
  'a user cannot mark someone else notification as read'
);

select * from finish();
rollback;
