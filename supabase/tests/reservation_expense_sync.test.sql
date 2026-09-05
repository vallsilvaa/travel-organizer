begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('99111111-1111-4111-8111-111111111111', 'ana@example.com'),
  ('99222222-2222-4222-8222-222222222222', 'bruno@example.com'),
  ('99333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Barcelona',
  '2027-07-01',
  '2027-07-10',
  '99111111-1111-4111-8111-111111111111'
);

set local role authenticated;
set local request.jwt.claim.sub = '99111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"99111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

insert into public.trip_reservations (
  id, trip_id, reservation_type, title, start_date, paid_amount, currency, payer_id, created_by
) values (
  '99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'lodging',
  'Hotel Barcelona',
  '2027-07-01',
  400.00,
  'EUR',
  '99111111-1111-4111-8111-111111111111',
  '99111111-1111-4111-8111-111111111111'
);

select public.sync_reservation_expense('99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- A paid reservation creates exactly one linked expense (#171).
select is(
  (select count(*) from public.trip_expenses where trip_id = '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'syncing a paid reservation creates exactly one expense'
);

select results_eq(
  $$
    select description, amount, currency, category, payment_status
    from public.trip_expenses
    where trip_id = '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  $$values ('Hotel Barcelona'::text, 400.00::numeric(14,2), 'EUR'::text, 'lodging'::text, 'paid'::text)$$,
  'the generated expense mirrors the reservation title, amount, currency, and category'
);

select ok(
  (select expense_id from public.trip_reservations where id = '99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is not null,
  'the reservation is stamped with the linked expense id'
);

select is(
  (
    select count(*) from public.trip_expense_shares
    where expense_id = (select expense_id from public.trip_reservations where id = '99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  ),
  1::bigint,
  'the generated expense has exactly one share, for the payer'
);

-- Editing the reservation and re-syncing updates the same expense, without
-- creating a second one.
update public.trip_reservations set paid_amount = 450.00 where id = '99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select public.sync_reservation_expense('99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

select is(
  (select count(*) from public.trip_expenses where trip_id = '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'editing and re-syncing the reservation does not duplicate its expense'
);

select results_eq(
  $$
    select amount from public.trip_expenses where trip_id = '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  $$values (450.00::numeric(14,2))$$,
  'the linked expense reflects the updated paid amount'
);

-- Clearing the paid amount removes the linked expense and unlinks it,
-- without leaving an orphan.
update public.trip_reservations
set paid_amount = null, currency = null, payer_id = null
where id = '99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select public.sync_reservation_expense('99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

select is(
  (select count(*) from public.trip_expenses where trip_id = '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'clearing the paid amount removes the auto-generated expense'
);

select ok(
  (select expense_id from public.trip_reservations where id = '99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is null,
  'clearing the paid amount unlinks the reservation from the deleted expense'
);

-- Re-marking it paid creates a fresh linked expense.
update public.trip_reservations
set paid_amount = 500.00, currency = 'EUR', payer_id = '99111111-1111-4111-8111-111111111111'
where id = '99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select public.sync_reservation_expense('99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

select is(
  (select count(*) from public.trip_expenses where trip_id = '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'marking the reservation paid again creates a fresh linked expense'
);

-- Deleting the reservation must not leave the linked expense behind.
delete from public.trip_reservations where id = '99bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is(
  (select count(*) from public.trip_expenses where trip_id = '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting the reservation deletes its linked expense, leaving no orphan'
);

-- A payer who is not a trip participant is rejected.
insert into public.trip_reservations (
  id, trip_id, reservation_type, title, start_date, paid_amount, currency, payer_id, created_by
) values (
  '99cccccc-cccc-4ccc-8ccc-cccccccccccc',
  '99aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'transport',
  'Taxi',
  '2027-07-02',
  30.00,
  'EUR',
  '99333333-3333-4333-8333-333333333333',
  '99111111-1111-4111-8111-111111111111'
);

select throws_ok(
  $$select public.sync_reservation_expense('99cccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'P0001',
  'invalid_payer',
  'a payer who is not a trip participant is rejected'
);

-- An outsider cannot sync a reservation on a trip they don't belong to.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '99333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"99333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select throws_ok(
  $$select public.sync_reservation_expense('99cccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'P0001',
  'not_authorized',
  'an outsider cannot sync a reservation on a trip they do not belong to'
);

select * from finish();
rollback;
