begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('95111111-1111-4111-8111-111111111111', 'ana@example.com'),
  ('95222222-2222-4222-8222-222222222222', 'bruno@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Athens',
  '2027-04-01',
  '2027-04-10',
  '95111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '95222222-2222-4222-8222-222222222222',
  'traveler'
);

set local role authenticated;
set local request.jwt.claim.sub = '95111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"95111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

-- A to_pay expense can be created with only an estimate, no amount/payer,
-- and no shares.
select lives_ok(
  $$
    select public.create_expense_with_shares(
      '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Planned museum tickets', null, 'EUR', 'activities',
      '2027-04-02', null, '[]'::jsonb, 'to_pay', 40.00
    )
  $$,
  'a to_pay expense can be created with only an estimate'
);

select results_eq(
  $$
    select payment_status, amount, estimated_amount, payer_id
    from public.trip_expenses
    where trip_id = '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and description = 'Planned museum tickets'
  $$,
  $$values ('to_pay'::text, null::numeric(14,2), 40.00::numeric(14,2), null::uuid)$$,
  'the to_pay expense stores the estimate without an amount or payer'
);

-- A 'paid' expense still requires an amount at the database level
-- (unchanged behavior, now enforced by a check constraint instead of a
-- not-null column) - the RPC itself never sends a null amount for a
-- payment_status of 'paid', but the constraint is the real backstop.
select throws_ok(
  $$
    select public.create_expense_with_shares(
      '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Missing amount', null, 'EUR', 'food',
      '2027-04-03', '95111111-1111-4111-8111-111111111111', '[]'::jsonb, 'paid', null
    )
  $$,
  '23514',
  null,
  'a paid expense without an amount violates the check constraint'
);

-- Marking a to_pay expense as paid (via the RPC) requires a real amount and
-- payer, and moves it into the balances.
select public.create_expense_with_shares(
  '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Snorkeling tour', 60.00, 'EUR', 'activities',
  '2027-04-04', '95111111-1111-4111-8111-111111111111',
  '[{"user_id": "95111111-1111-4111-8111-111111111111", "share_amount": 60.00}]'::jsonb,
  'paid', null
);

select results_eq(
  $$
    select display_name, total_paid from public.get_trip_expense_balances('95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    where currency = 'EUR' and display_name = 'ana'
  $$,
  $$values ('ana'::text, 60.00::numeric(14,2))$$,
  'a paid expense counts toward balances'
);

-- The to_pay expense above must not affect anyone's balance.
select is(
  (
    select count(*) from public.get_trip_expense_balances('95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') balances
    where balances.currency = 'EUR' and balances.total_paid <> 60.00
  ),
  0::bigint,
  'a to_pay expense does not shift anyone''s balance until it is paid'
);

-- get_trip_expense_summary computes per-currency estimated/paid/to_pay
-- totals correctly.
select results_eq(
  $$
    select estimated_total, paid_total, to_pay_total
    from public.get_trip_expense_summary('95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    where currency = 'EUR'
  $$,
  $$values (40.00::numeric(14,2), 60.00::numeric(14,2), 40.00::numeric(14,2))$$,
  'the summary totals estimated, paid, and to_pay amounts separately per currency'
);

-- An outsider cannot read the summary for a trip they do not belong to.
reset role;
insert into auth.users (id, email) values ('95333333-3333-4333-8333-333333333333', 'outsider@example.com');
set local role authenticated;
set local request.jwt.claim.sub = '95333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"95333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select throws_ok(
  $$select * from public.get_trip_expense_summary('95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_authorized',
  'an outsider cannot read the trip expense summary'
);

select * from finish();
rollback;
