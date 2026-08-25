begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('95111111-1111-4111-8111-111111111111', 'ana@example.com'),
  ('95222222-2222-4222-8222-222222222222', 'bruno@example.com'),
  ('95333333-3333-4333-8333-333333333333', 'carla@example.com'),
  ('95444444-4444-4444-8444-444444444444', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Kyoto',
  '2027-11-01',
  '2027-11-10',
  '95111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values
  ('95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '95222222-2222-4222-8222-222222222222', 'organizer'),
  ('95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '95333333-3333-4333-8333-333333333333', 'traveler');

-- The creator can add the guide.
set local role authenticated;
set local request.jwt.claim.sub = '95111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"95111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

select lives_ok(
  $$
    select public.update_destination_guide(
      '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Leve um guarda-chuva, chove bastante em novembro.',
      'Guia da Ana',
      '2027-10-01'::date
    )
  $$,
  'the trip creator can add the destination guide'
);

select results_eq(
  $$
    select destination_guide_content, destination_guide_source, destination_guide_reviewed_at
    from public.trips
    where id = '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  $$
    values (
      'Leve um guarda-chuva, chove bastante em novembro.'::text,
      'Guia da Ana'::text,
      '2027-10-01'::date
    )
  $$,
  'the guide content, source, and reviewed date were saved'
);

-- An organizer (not the creator) can also edit the guide.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '95222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"95222222-2222-4222-8222-222222222222","email":"bruno@example.com","role":"authenticated"}';

select lives_ok(
  $$
    select public.update_destination_guide(
      '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Atualizado: o museu fecha às segundas.',
      null,
      null
    )
  $$,
  'an organizer can also edit the destination guide'
);

-- A regular traveler (not the creator, not an organizer) cannot edit it.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '95333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"95333333-3333-4333-8333-333333333333","email":"carla@example.com","role":"authenticated"}';

select throws_ok(
  $$
    select public.update_destination_guide(
      '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Sneaky edit',
      null,
      null
    )
  $$,
  'P0001',
  'not_authorized',
  'a plain traveler participant cannot edit the destination guide'
);

-- An outsider cannot edit it either.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '95444444-4444-4444-8444-444444444444';
set local request.jwt.claims = '{"sub":"95444444-4444-4444-8444-444444444444","email":"outsider@example.com","role":"authenticated"}';

select throws_ok(
  $$
    select public.update_destination_guide(
      '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Sneaky edit',
      null,
      null
    )
  $$,
  'P0001',
  'not_authorized',
  'an outsider cannot edit the destination guide'
);

-- The guide cannot be edited once the trip is archived.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '95111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"95111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

update public.trips set archived_at = now()
where id = '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $$
    select public.update_destination_guide(
      '95aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Too late',
      null,
      null
    )
  $$,
  'P0001',
  'trip_archived',
  'the destination guide is read-only once the trip is archived'
);

select * from finish();
rollback;
