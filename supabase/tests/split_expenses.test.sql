begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('81111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('82222222-2222-4222-8222-222222222222', 'organizer@example.com'),
  ('83333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Roma',
  '2027-07-01',
  '2027-07-10',
  '81111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '82222222-2222-4222-8222-222222222222',
  'organizer'
);

set local role authenticated;
set local request.jwt.claim.sub = '81111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"81111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

-- A matching split succeeds and creates both the expense and its shares.
select lives_ok(
  $$
    select public.create_expense_with_shares(
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Dinner',
      100.00,
      'EUR',
      'food',
      '2027-07-02',
      '81111111-1111-4111-8111-111111111111',
      '[
        {"user_id": "81111111-1111-4111-8111-111111111111", "share_amount": 60.00},
        {"user_id": "82222222-2222-4222-8222-222222222222", "share_amount": 40.00}
      ]'::jsonb
    )
  $$,
  'a matching split creates the expense'
);

select is(
  (select count(*) from public.trip_expenses where trip_id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'exactly one expense was created'
);

select is(
  (select count(*) from public.trip_expense_shares ts
   join public.trip_expenses te on te.id = ts.expense_id
   where te.trip_id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  2::bigint,
  'both shares were recorded'
);

select is(
  (select sum(share_amount) from public.trip_expense_shares ts
   join public.trip_expenses te on te.id = ts.expense_id
   where te.trip_id = '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  100.00::numeric(14,2),
  'shares sum to the expense total'
);

-- A mismatched split is rejected and nothing is created (rolled back).
select throws_ok(
  $$
    select public.create_expense_with_shares(
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Museum tickets',
      50.00,
      'EUR',
      'activities',
      '2027-07-03',
      '81111111-1111-4111-8111-111111111111',
      '[
        {"user_id": "81111111-1111-4111-8111-111111111111", "share_amount": 20.00},
        {"user_id": "82222222-2222-4222-8222-222222222222", "share_amount": 20.00}
      ]'::jsonb
    )
  $$,
  'P0001',
  'shares_do_not_match_total',
  'a mismatched split is rejected'
);

select is(
  (select count(*) from public.trip_expenses where description = 'Museum tickets'),
  0::bigint,
  'the mismatched expense was not created'
);

-- A non-participant cannot be included in the split.
select throws_ok(
  $$
    select public.create_expense_with_shares(
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Taxi',
      30.00,
      'EUR',
      'transport',
      '2027-07-04',
      '81111111-1111-4111-8111-111111111111',
      '[
        {"user_id": "81111111-1111-4111-8111-111111111111", "share_amount": 15.00},
        {"user_id": "83333333-3333-4333-8333-333333333333", "share_amount": 15.00}
      ]'::jsonb
    )
  $$,
  'P0001',
  'invalid_participant',
  'a non-participant cannot be included in the split'
);

select is(
  (select count(*) from public.trip_expenses where description = 'Taxi'),
  0::bigint,
  'the expense with a non-participant share was not created'
);

-- A non-participant payer is rejected.
select throws_ok(
  $$
    select public.create_expense_with_shares(
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Snacks',
      10.00,
      'EUR',
      'food',
      '2027-07-04',
      '83333333-3333-4333-8333-333333333333',
      '[]'::jsonb
    )
  $$,
  'P0001',
  'invalid_payer',
  'a non-participant payer is rejected'
);

-- An unsplit expense (no shares) is still allowed.
select lives_ok(
  $$
    select public.create_expense_with_shares(
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Coffee',
      5.00,
      'EUR',
      'food',
      '2027-07-05',
      '81111111-1111-4111-8111-111111111111',
      '[]'::jsonb
    )
  $$,
  'an expense without a split can still be created'
);

reset role;

-- An outsider cannot create an expense on this trip at all.
set local role authenticated;
set local request.jwt.claim.sub = '83333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"83333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select throws_ok(
  $$
    select public.create_expense_with_shares(
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Sneaky',
      1.00,
      'EUR',
      'other',
      '2027-07-06',
      '83333333-3333-4333-8333-333333333333',
      '[]'::jsonb
    )
  $$,
  'P0001',
  'not_authorized',
  'an outsider cannot create expenses on the trip'
);

reset role;

-- Editing an expense replaces its shares atomically.
set local role authenticated;
set local request.jwt.claim.sub = '81111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"81111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

select lives_ok(
  $$
    select public.update_expense_with_shares(
      (select id from public.trip_expenses where description = 'Dinner'),
      '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Dinner',
      100.00,
      'EUR',
      'food',
      '2027-07-02',
      '81111111-1111-4111-8111-111111111111',
      '[
        {"user_id": "81111111-1111-4111-8111-111111111111", "share_amount": 100.00}
      ]'::jsonb
    )
  $$,
  'editing an expense can re-split it'
);

select is(
  (select count(*) from public.trip_expense_shares ts
   join public.trip_expenses te on te.id = ts.expense_id
   where te.description = 'Dinner'),
  1::bigint,
  'the old share was replaced, not appended'
);

-- Deleting an expense cascades to delete its shares.
select results_eq(
  $$
    delete from public.trip_expenses where description = 'Dinner' returning description
  $$,
  $$values ('Dinner'::text)$$,
  'the creator can delete an expense'
);

reset role;
select is(
  (select count(*) from public.trip_expense_shares),
  0::bigint,
  'deleting an expense removes its shares'
);

-- RLS: only participants can read shares.
insert into public.trip_expenses (
  id, trip_id, description, amount, currency, category, expense_date, payer_id, created_by
) values (
  '8eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Groceries',
  20.00,
  'EUR',
  'food',
  '2027-07-07',
  '81111111-1111-4111-8111-111111111111',
  '81111111-1111-4111-8111-111111111111'
);
insert into public.trip_expense_shares (expense_id, trip_id, user_id, share_amount) values (
  '8eeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '81111111-1111-4111-8111-111111111111',
  20.00
);

set local role authenticated;
set local request.jwt.claim.sub = '83333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"83333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.trip_expense_shares),
  0::bigint,
  'an outsider cannot see any expense shares'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '82222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"82222222-2222-4222-8222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.trip_expense_shares),
  1::bigint,
  'a trip participant can see the expense shares'
);

select * from finish();
rollback;
