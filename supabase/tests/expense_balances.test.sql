begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('91111111-1111-4111-8111-111111111111', 'ana@example.com'),
  ('92222222-2222-4222-8222-222222222222', 'bruno@example.com'),
  ('93333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Madri',
  '2027-08-01',
  '2027-08-10',
  '91111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '92222222-2222-4222-8222-222222222222',
  'organizer'
);

set local role authenticated;
set local request.jwt.claim.sub = '91111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"91111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

-- Ana pays 100 EUR for dinner, split evenly with Bruno.
select public.create_expense_with_shares(
  '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Dinner',
  100.00,
  'EUR',
  'food',
  '2027-08-02',
  '91111111-1111-4111-8111-111111111111',
  '[
    {"user_id": "91111111-1111-4111-8111-111111111111", "share_amount": 50.00},
    {"user_id": "92222222-2222-4222-8222-222222222222", "share_amount": 50.00}
  ]'::jsonb
);

-- Ana also pays 20 USD for a snack, unsplit (no shares at all).
select public.create_expense_with_shares(
  '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Snack',
  20.00,
  'USD',
  'food',
  '2027-08-02',
  '91111111-1111-4111-8111-111111111111',
  '[]'::jsonb
);

select results_eq(
  $$
    select display_name, total_paid, total_owed, net_balance
    from public.get_trip_expense_balances('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    where currency = 'EUR'
    order by display_name
  $$,
  $$
    values
      ('ana'::text, 100.00::numeric(14,2), 50.00::numeric(14,2), 50.00::numeric(14,2)),
      ('bruno'::text, 0.00::numeric(14,2), 50.00::numeric(14,2), -50.00::numeric(14,2))
  $$,
  'EUR balances reflect who paid and who owes their share'
);

select results_eq(
  $$
    select display_name, total_paid, total_owed, net_balance
    from public.get_trip_expense_balances('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    where currency = 'USD'
  $$,
  $$values ('ana'::text, 20.00::numeric(14,2), 0.00::numeric(14,2), 20.00::numeric(14,2))$$,
  'an unsplit expense counts toward what its payer paid but creates no debt for anyone'
);

-- An outsider gets nothing back from the balances RPC.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '93333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"93333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.get_trip_expense_balances('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  0::bigint,
  'an outsider cannot see the trip balances'
);

-- Removing Bruno from the trip must not erase his historical balance.
reset role;
delete from public.trip_participants
where trip_id = '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = '92222222-2222-4222-8222-222222222222';

set local role authenticated;
set local request.jwt.claim.sub = '91111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"91111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

select results_eq(
  $$
    select display_name, net_balance
    from public.get_trip_expense_balances('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    where currency = 'EUR' and display_name = 'bruno'
  $$,
  $$values ('bruno'::text, -50.00::numeric(14,2))$$,
  'a removed participant still shows their historical balance and name'
);

select * from finish();
rollback;
