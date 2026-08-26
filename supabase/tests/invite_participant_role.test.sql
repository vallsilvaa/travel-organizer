begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('71111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('72222222-2222-4222-8222-222222222222', 'traveler-invitee@example.com');

insert into public.trips (id, destination, start_date, created_by) values (
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Rome',
  '2027-06-01',
  '71111111-1111-4111-8111-111111111111'
);

set local role authenticated;
set local request.jwt.claim.sub = '71111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"71111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

-- The creator can invite someone explicitly as a traveler, not just an organizer.
select lives_ok(
  $$
    insert into public.trip_invitations (
      id, trip_id, trip_destination, email, role, invited_by
    ) values (
      '79999999-9999-4999-8999-999999999999',
      '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Rome',
      'traveler-invitee@example.com',
      'traveler',
      '71111111-1111-4111-8111-111111111111'
    )
  $$,
  'the creator can invite a participant as a traveler'
);

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '72222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"72222222-2222-4222-8222-222222222222","email":"traveler-invitee@example.com","role":"authenticated"}';

update public.trip_invitations
set status = 'accepted', responded_at = now(), invited_user_id = '72222222-2222-4222-8222-222222222222'
where id = '79999999-9999-4999-8999-999999999999';

reset role;

select is(
  (select role from public.trip_participants
    where trip_id = '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and user_id = '72222222-2222-4222-8222-222222222222'),
  'traveler',
  'accepting a traveler invitation adds the invitee as a traveler, not an organizer'
);

-- The creator can remove a traveler participant too, not only organizers.
set local role authenticated;
set local request.jwt.claim.sub = '71111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"71111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

select results_eq(
  $$
    delete from public.trip_participants
    where trip_id = '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and user_id = '72222222-2222-4222-8222-222222222222'
    returning user_id
  $$,
  $$values ('72222222-2222-4222-8222-222222222222'::uuid)$$,
  'the creator can remove a traveler participant'
);

reset role;
select is(
  (select count(*) from public.trip_participants
    where trip_id = '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and user_id = '72222222-2222-4222-8222-222222222222'),
  0::bigint,
  'the removed traveler immediately loses trip membership'
);

select * from finish();
rollback;
