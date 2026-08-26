begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'creator@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'organizer@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'unrelated@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'invitee@example.com');

insert into public.trips (id, destination, start_date, created_by) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Londres',
    '2027-04-01',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Paris',
    '2027-05-01',
    '33333333-3333-3333-3333-333333333333'
  );

insert into public.trip_participants (trip_id, user_id, role) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'organizer'
);

insert into public.itinerary_items (
  id, trip_id, item_date, title, created_by
) values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '2027-04-02',
  'Museu',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.trip_tasks (
  id, trip_id, title, owner_id, due_date, created_by
) values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Comprar ingressos',
  '22222222-2222-2222-2222-222222222222',
  '2027-03-20',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.item_comments (
  id, trip_id, item_type, task_id, body, author_id
) values
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'task',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Comentário do criador',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'e2222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'task',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Comentário do organizador',
    '22222222-2222-2222-2222-222222222222'
  );

insert into public.trip_expenses (
  id,
  trip_id,
  description,
  amount,
  currency,
  category,
  expense_date,
  payer_id,
  created_by
) values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Hotel',
  500,
  'GBP',
  'lodging',
  '2027-04-01',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.trip_invitations (
  id,
  trip_id,
  trip_destination,
  email,
  invited_by
) values (
  '99999999-9999-9999-9999-999999999999',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Londres',
  'invitee@example.com',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.task_reminder_deliveries (
  id, task_id, owner_id, due_date
) values (
  '88888888-8888-8888-8888-888888888888',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '22222222-2222-2222-2222-222222222222',
  '2027-03-20'
);

select is(
  (
    select count(*)
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in (
        'profiles',
        'trips',
        'trip_participants',
        'trip_invitations',
        'itinerary_items',
        'trip_tasks',
        'item_comments',
        'trip_expenses',
        'task_reminder_deliveries'
      )
      and pg_class.relrowsecurity
  ),
  9::bigint,
  'RLS is enabled on every application table'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_trip_participants(uuid)',
    'execute'
  ),
  'signed-out visitors cannot execute the participant RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.add_accepted_participant_to_trip()',
    'execute'
  ),
  'clients cannot execute the invitation trigger function directly'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"creator@example.com","role":"authenticated"}';

select results_eq(
  $$select id from public.trips order by id$$,
  $$values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$,
  'the creator reads only trips they participate in'
);

select is(
  (select count(*) from public.trip_participants),
  2::bigint,
  'the creator can directly read all participants of their own trip'
);

select is(
  (select count(*) from public.get_trip_participants(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )),
  2::bigint,
  'the creator can list all participants through the guarded RPC'
);

select is((select count(*) from public.itinerary_items), 1::bigint,
  'the creator reads itinerary data');
select is((select count(*) from public.trip_tasks), 1::bigint,
  'the creator reads task data');
select is((select count(*) from public.item_comments), 2::bigint,
  'the creator reads comment data');
select is((select count(*) from public.trip_expenses), 1::bigint,
  'the creator reads expense data');
select is((select count(*) from public.trip_invitations), 1::bigint,
  'the creator reads invitations they sent');

select results_eq(
  $$
    insert into public.trip_tasks (
      trip_id, title, owner_id, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Tarefa compartilhada',
      '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111'
    ) returning owner_id
  $$,
  $$values ('22222222-2222-2222-2222-222222222222'::uuid)$$,
  'the creator can assign a task to another participant'
);

select lives_ok(
  $$
    select public.create_expense_with_shares(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Transporte',
      20,
      'GBP',
      'transport',
      '2027-04-02',
      '22222222-2222-2222-2222-222222222222',
      '[]'::jsonb
    )
  $$,
  'the creator can assign an expense to another participant'
);

select is(
  (select payer_id from public.trip_expenses where description = 'Transporte'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'the new expense is assigned to the intended payer'
);

select throws_ok(
  $$
    update public.trip_tasks
    set created_by = '33333333-3333-3333-3333-333333333333'
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  $$,
  '42501',
  null,
  'clients cannot rewrite task audit ownership'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select results_eq(
  $$select id from public.trips order by id$$,
  $$values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$,
  'the organizer reads the assisted trip'
);

select is((select count(*) from public.itinerary_items), 1::bigint,
  'the organizer reads itinerary data');
select is((select count(*) from public.trip_tasks), 2::bigint,
  'the organizer reads task data');
select is((select count(*) from public.item_comments), 2::bigint,
  'the organizer reads comment data');
select is((select count(*) from public.trip_expenses), 2::bigint,
  'the organizer reads expense data');
select is((select count(*) from public.task_reminder_deliveries), 1::bigint,
  'the organizer reads only their reminder status while participating');
select is((select count(*) from public.trip_invitations), 0::bigint,
  'an organizer cannot inspect invitations sent by the creator');

select results_eq(
  $$
    update public.itinerary_items
    set title = 'Museu atualizado'
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    returning title
  $$,
  array['Museu atualizado'::text],
  'the organizer can update collaborative itinerary data'
);

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","email":"unrelated@example.com","role":"authenticated"}';

select is((select count(*) from public.trips where id =
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint,
  'an unrelated user cannot read the assisted trip');
select is((select count(*) from public.itinerary_items), 0::bigint,
  'an unrelated user cannot read itinerary data');
select is((select count(*) from public.trip_tasks), 0::bigint,
  'an unrelated user cannot read task data');
select is((select count(*) from public.item_comments), 0::bigint,
  'an unrelated user cannot read comment data');
select is((select count(*) from public.trip_expenses), 0::bigint,
  'an unrelated user cannot read expense data');
select is((select count(*) from public.task_reminder_deliveries), 0::bigint,
  'an unrelated user cannot read reminder data');
select is((select count(*) from public.get_trip_participants(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
)), 0::bigint,
  'the participant RPC leaks no data to an unrelated user');

select throws_ok(
  $$
    insert into public.itinerary_items (
      trip_id, item_date, title, created_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '2027-04-03',
      'Tentativa indevida',
      '33333333-3333-3333-3333-333333333333'
    )
  $$,
  '42501',
  null,
  'an unrelated user cannot add collaborative data'
);

select is_empty(
  $$
    update public.trip_invitations
    set
      status = 'accepted',
      responded_at = now(),
      invited_user_id = '33333333-3333-3333-3333-333333333333'
    where id = '99999999-9999-9999-9999-999999999999'
    returning id
  $$,
  'a user cannot accept an invitation addressed to someone else'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","email":"invitee@example.com","role":"authenticated"}';

select is((select count(*) from public.trip_invitations), 1::bigint,
  'an invitee reads only the invitation addressed to their verified email');

select results_eq(
  $$
    update public.trip_invitations
    set
      status = 'accepted',
      responded_at = now(),
      invited_user_id = '44444444-4444-4444-4444-444444444444'
    where id = '99999999-9999-9999-9999-999999999999'
    returning id
  $$,
  $$values ('99999999-9999-9999-9999-999999999999'::uuid)$$,
  'the intended invitee can accept exactly once'
);

select ok(
  (select private.is_trip_participant(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '44444444-4444-4444-4444-444444444444'
  )),
  'the guarded trigger adds only the accepted invitee as organizer'
);

reset role;
delete from public.trip_participants
where trip_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  and user_id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select is_empty(
  $$
    update public.item_comments
    set body = 'Não deveria atualizar'
    where id = 'e2222222-2222-2222-2222-222222222222'
    returning id
  $$,
  'a removed organizer cannot update a comment they authored'
);

select is_empty(
  $$
    delete from public.item_comments
    where id = 'e2222222-2222-2222-2222-222222222222'
    returning id
  $$,
  'a removed organizer cannot delete a comment they authored'
);

select is((select count(*) from public.task_reminder_deliveries), 0::bigint,
  'a removed organizer cannot read stale reminder status');

reset role;
set local role anon;

select throws_ok(
  $$select * from public.trips$$,
  '42501',
  null,
  'a signed-out visitor cannot read trips'
);

select throws_ok(
  $$select * from public.trip_tasks$$,
  '42501',
  null,
  'a signed-out visitor cannot read collaborative data'
);

select throws_ok(
  $$select * from public.get_trip_participants(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )$$,
  '42501',
  null,
  'a signed-out visitor cannot call privileged participant functions'
);

select * from finish();
rollback;
