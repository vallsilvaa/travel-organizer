begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('95111111-1111-4111-8111-111111111111', 'organizer@example.com'),
  ('95222222-2222-4222-8222-222222222222', 'traveler@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rome', '2027-01-01', '2027-01-10', '95111111-1111-4111-8111-111111111111'
);

insert into public.trip_tasks (id, trip_id, title, owner_id, due_date, created_by) values (
  '95bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Buy travel insurance',
  '95222222-2222-4222-8222-222222222222',
  '2026-12-20',
  '95111111-1111-4111-8111-111111111111'
);

-- The cron route always writes via the service role; seed directly here.
insert into public.overdue_task_reminder_deliveries (task_id, recipient_id, alert_date, status) values (
  '95bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '95222222-2222-4222-8222-222222222222', '2027-01-05', 'sent'
);

-- A second alert for the same task, recipient and day is rejected - the
-- daily claim only fires once per (task, recipient, day).
select throws_ok(
  $$
    insert into public.overdue_task_reminder_deliveries (task_id, recipient_id, alert_date)
    values ('95bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '95222222-2222-4222-8222-222222222222', '2027-01-05')
  $$,
  '23505',
  null,
  'a second alert for the same task, recipient and day is rejected'
);

-- ...but the next day is a fresh, claimable alert (still overdue tomorrow).
select lives_ok(
  $$
    insert into public.overdue_task_reminder_deliveries (task_id, recipient_id, alert_date)
    values ('95bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '95222222-2222-4222-8222-222222222222', '2027-01-06')
  $$,
  'a task still overdue the next day can be claimed again for that day'
);

set local role authenticated;
set local request.jwt.claim.sub = '95222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"95222222-2222-4222-8222-222222222222","email":"traveler@example.com","role":"authenticated"}';

select is(
  (select count(*)::int from public.overdue_task_reminder_deliveries where task_id = '95bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'the recipient can see their own delivery rows'
);

set local request.jwt.claim.sub = '95111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"95111111-1111-4111-8111-111111111111","email":"organizer@example.com","role":"authenticated"}';

select is(
  (select count(*)::int from public.overdue_task_reminder_deliveries where task_id = '95bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0,
  'RLS hides another user''s delivery rows, even the trip organizer'
);

select * from finish();
rollback;
