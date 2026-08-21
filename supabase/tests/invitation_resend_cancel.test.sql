begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('71111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('72222222-2222-4222-8222-222222222222', 'outsider@example.com'),
  ('73333333-3333-4333-8333-333333333333', 'invitee@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Porto',
  '2027-06-01',
  '2027-06-10',
  '71111111-1111-4111-8111-111111111111'
);

insert into public.trip_invitations (
  id, trip_id, trip_destination, email, invited_by
) values (
  '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Porto',
  'invitee@example.com',
  '71111111-1111-4111-8111-111111111111'
);

-- An outsider cannot cancel or resend someone else's invitation.
set local role authenticated;
set local request.jwt.claim.sub = '72222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"72222222-2222-4222-8222-222222222222","email":"outsider@example.com","role":"authenticated"}';

select lives_ok(
  $$update public.trip_invitations set status = 'cancelled', responded_at = now() where id = '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  'an outsider cancellation is safely ignored by RLS'
);

reset role;
select is(
  (select status from public.trip_invitations where id = '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'pending',
  'the invitation is still pending after an outsider tries to cancel it'
);

-- The trip creator can resend (extend the expiry) without changing status.
set local role authenticated;
set local request.jwt.claim.sub = '71111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"71111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

select results_eq(
  $$
    update public.trip_invitations
    set expires_at = now() + interval '7 days'
    where id = '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    returning status
  $$,
  $$values ('pending'::text)$$,
  'the creator can resend a pending invitation without changing its status'
);

-- The trip creator can cancel a pending invitation.
select results_eq(
  $$
    update public.trip_invitations
    set status = 'cancelled', responded_at = now()
    where id = '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    returning status
  $$,
  $$values ('cancelled'::text)$$,
  'the creator can cancel a pending invitation'
);

-- A cancelled invitation can no longer be accepted.
set local role authenticated;
set local request.jwt.claim.sub = '73333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"73333333-3333-4333-8333-333333333333","email":"invitee@example.com","role":"authenticated"}';

select lives_ok(
  $$
    update public.trip_invitations
    set status = 'accepted', responded_at = now(), invited_user_id = '73333333-3333-4333-8333-333333333333'
    where id = '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  $$,
  'accepting a cancelled invitation is safely ignored by RLS'
);

reset role;
select is(
  (select status from public.trip_invitations where id = '7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'cancelled',
  'the invitation remains cancelled and was not accepted'
);

-- An expired (but still pending) invitation cannot be accepted either.
insert into public.trip_invitations (
  id, trip_id, trip_destination, email, invited_by, expires_at
) values (
  '7ccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Porto',
  'expired@example.com',
  '71111111-1111-4111-8111-111111111111',
  now() - interval '1 day'
);

insert into auth.users (id, email) values
  ('74444444-4444-4444-8444-444444444444', 'expired@example.com');

set local role authenticated;
set local request.jwt.claim.sub = '74444444-4444-4444-8444-444444444444';
set local request.jwt.claims = '{"sub":"74444444-4444-4444-8444-444444444444","email":"expired@example.com","role":"authenticated"}';

select lives_ok(
  $$
    update public.trip_invitations
    set status = 'accepted', responded_at = now(), invited_user_id = '74444444-4444-4444-8444-444444444444'
    where id = '7ccccccc-cccc-4ccc-8ccc-cccccccccccc'
  $$,
  'accepting an expired invitation is safely ignored by RLS'
);

reset role;
select is(
  (select status from public.trip_invitations where id = '7ccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  'pending',
  'the expired invitation was not accepted'
);

select * from finish();
rollback;
