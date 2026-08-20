begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(25);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'creator@example.com',
    '',
    now(),
    '{"display_name":"Creator"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'organizer@example.com',
    '',
    now(),
    '{"display_name":"Organizer"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'outsider@example.com',
    '',
    now(),
    '{"display_name":"Outsider"}'::jsonb,
    now(),
    now()
  );

insert into public.trips (
  id,
  destination,
  start_date,
  end_date,
  created_by
)
values (
  '00000000-0000-0000-0000-000000000010',
  'Security Test',
  '2027-05-10',
  '2027-05-17',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.trip_participants (trip_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000002',
  'organizer'
);

insert into public.itinerary_items (
  id,
  trip_id,
  item_date,
  title,
  created_by
)
values (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000010',
  '2027-05-11',
  'Museum',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.trip_tasks (
  id,
  trip_id,
  title,
  owner_id,
  created_by
)
values (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000010',
  'Insurance',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.item_comments (
  id,
  trip_id,
  item_type,
  itinerary_item_id,
  body,
  author_id
)
values (
  '00000000-0000-0000-0000-000000000040',
  '00000000-0000-0000-0000-000000000010',
  'itinerary',
  '00000000-0000-0000-0000-000000000020',
  'Confirmed',
  '00000000-0000-0000-0000-000000000001'
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
)
values (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000010',
  'Dinner',
  100,
  'BRL',
  'food',
  '2027-05-11',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.trip_invitations (
  id,
  trip_id,
  trip_destination,
  email,
  invited_by
)
values (
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-000000000010',
  'Security Test',
  'pending@example.com',
  '00000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"creator@example.com","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

select extensions.is((select count(*)::integer from public.trips), 1, 'creator sees the trip');
select extensions.is((select count(*)::integer from public.itinerary_items), 1, 'creator sees itinerary');
select extensions.is((select count(*)::integer from public.trip_tasks), 1, 'creator sees tasks');
select extensions.is((select count(*)::integer from public.item_comments), 1, 'creator sees comments');
select extensions.is((select count(*)::integer from public.trip_expenses), 1, 'creator sees expenses');
select extensions.is((select count(*)::integer from public.trip_invitations), 1, 'creator sees invitations');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","email":"organizer@example.com","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
);

select extensions.is((select count(*)::integer from public.trips), 1, 'organizer sees the shared trip');
select extensions.is((select count(*)::integer from public.itinerary_items), 1, 'organizer sees itinerary');
select extensions.is((select count(*)::integer from public.trip_tasks), 1, 'organizer sees tasks');
select extensions.is((select count(*)::integer from public.item_comments), 1, 'organizer sees comments');
select extensions.is((select count(*)::integer from public.trip_expenses), 1, 'organizer sees expenses');
select extensions.is(
  (
    select count(*)::integer
    from public.get_trip_participants('00000000-0000-0000-0000-000000000010')
  ),
  2,
  'participant function returns only the shared trip participants'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000003","email":"outsider@example.com","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000003',
  true
);

select extensions.is((select count(*)::integer from public.trips), 0, 'unrelated user cannot see trips');
select extensions.is((select count(*)::integer from public.itinerary_items), 0, 'unrelated user cannot see itinerary');
select extensions.is((select count(*)::integer from public.trip_tasks), 0, 'unrelated user cannot see tasks');
select extensions.is((select count(*)::integer from public.item_comments), 0, 'unrelated user cannot see comments');
select extensions.is((select count(*)::integer from public.trip_expenses), 0, 'unrelated user cannot see expenses');
select extensions.is((select count(*)::integer from public.trip_invitations), 0, 'unrelated user cannot see invitations');
select extensions.is(
  (
    select count(*)::integer
    from public.get_trip_participants('00000000-0000-0000-0000-000000000010')
  ),
  0,
  'privileged participant function does not leak data'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","email":"organizer@example.com","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
);

select extensions.lives_ok(
  $$
    insert into public.trip_expenses (
      trip_id,
      description,
      amount,
      currency,
      category,
      expense_date,
      payer_id,
      created_by
    )
    values (
      '00000000-0000-0000-0000-000000000010',
      'Shared hotel',
      200,
      'BRL',
      'lodging',
      '2027-05-12',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  'organizer can record an expense paid by another participant'
);

reset role;

select extensions.is(
  has_table_privilege('anon', 'public.trips', 'select'),
  false,
  'signed-out visitors cannot select trips'
);
select extensions.is(
  has_column_privilege('authenticated', 'public.itinerary_items', 'created_by', 'update'),
  false,
  'itinerary provenance is immutable'
);
select extensions.is(
  has_column_privilege('authenticated', 'public.trip_tasks', 'trip_id', 'update'),
  false,
  'task trip ownership is immutable'
);
select extensions.is(
  has_column_privilege('authenticated', 'public.trip_expenses', 'created_by', 'update'),
  false,
  'expense provenance is immutable'
);
select extensions.is(
  has_column_privilege('authenticated', 'public.itinerary_items', 'title', 'update'),
  true,
  'participants retain permission to edit allowed itinerary fields'
);

select * from extensions.finish();

rollback;
