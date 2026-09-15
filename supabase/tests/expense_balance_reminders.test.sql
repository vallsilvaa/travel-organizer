begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('97111111-1111-4111-8111-111111111111', 'ana@example.com'),
  ('97222222-2222-4222-8222-222222222222', 'bruno@example.com'),
  ('97444444-4444-4444-8444-444444444444', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Rome',
  '2027-11-01',
  '2027-11-10',
  '97111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values
  ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '97222222-2222-4222-8222-222222222222', 'traveler');

-- Ana is owed money by Bruno and reminds him.
set local role authenticated;
set local request.jwt.claim.sub = '97111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"97111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.expense_balance_reminders (trip_id, from_user_id, to_user_id, currency)
    values ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '97111111-1111-4111-8111-111111111111', '97222222-2222-4222-8222-222222222222', 'EUR')
  $$,
  'a trip participant can send a reminder to a co-participant'
);

select throws_ok(
  $$
    insert into public.expense_balance_reminders (trip_id, from_user_id, to_user_id, currency)
    values ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '97222222-2222-4222-8222-222222222222', '97111111-1111-4111-8111-111111111111', 'EUR')
  $$,
  '42501',
  null,
  'a user cannot record a reminder as sent by someone else'
);

select throws_ok(
  $$
    insert into public.expense_balance_reminders (trip_id, from_user_id, to_user_id, currency)
    values ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '97111111-1111-4111-8111-111111111111', '97444444-4444-4444-8444-444444444444', 'EUR')
  $$,
  '42501',
  null,
  'a reminder cannot target someone outside the trip'
);

select is(
  (select count(*)::int from public.expense_balance_reminders where to_user_id = '97222222-2222-4222-8222-222222222222'),
  1,
  'the sender can see the reminder they just sent'
);

-- The trip creator cannot see a reminder sent by someone else.
reset role;
insert into public.trip_participants (trip_id, user_id, role) values
  ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '97444444-4444-4444-8444-444444444444', 'traveler');

set local role authenticated;
set local request.jwt.claim.sub = '97444444-4444-4444-8444-444444444444';
set local request.jwt.claims = '{"sub":"97444444-4444-4444-8444-444444444444","email":"outsider@example.com","role":"authenticated"}';

select is(
  (select count(*)::int from public.expense_balance_reminders),
  0,
  'RLS hides a reminder sent by another participant'
);

-- The reminder cannot be sent once the trip is archived.
reset role;
update public.trips set archived_at = now()
where id = '97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set local role authenticated;
set local request.jwt.claim.sub = '97111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"97111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.expense_balance_reminders (trip_id, from_user_id, to_user_id, currency)
    values ('97aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '97111111-1111-4111-8111-111111111111', '97222222-2222-4222-8222-222222222222', 'EUR')
  $$,
  '42501',
  null,
  'no new reminder can be sent once the trip is archived'
);

select * from finish();
rollback;
