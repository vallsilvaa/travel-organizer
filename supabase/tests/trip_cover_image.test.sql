begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('96111111-1111-4111-8111-111111111111', 'ana@example.com'),
  ('96222222-2222-4222-8222-222222222222', 'bruno@example.com'),
  ('96333333-3333-4333-8333-333333333333', 'carla@example.com'),
  ('96444444-4444-4444-8444-444444444444', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Porto',
  '2027-11-01',
  '2027-11-10',
  '96111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values
  ('96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '96222222-2222-4222-8222-222222222222', 'organizer'),
  ('96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '96333333-3333-4333-8333-333333333333', 'traveler');

-- The creator can set the cover image.
set local role authenticated;
set local request.jwt.claim.sub = '96111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"96111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

select lives_ok(
  $$
    select public.update_trip_cover_image(
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cover-1.jpg'
    )
  $$,
  'the trip creator can set the cover image'
);

select results_eq(
  $$
    select cover_image_path
    from public.trips
    where id = '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  $$
    values ('96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cover-1.jpg'::text)
  $$,
  'the cover image path was saved'
);

-- An organizer (not the creator) can also replace it.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '96222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"96222222-2222-4222-8222-222222222222","email":"bruno@example.com","role":"authenticated"}';

select lives_ok(
  $$
    select public.update_trip_cover_image(
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cover-2.jpg'
    )
  $$,
  'an organizer can also replace the cover image'
);

-- ...and clear it, since null is how the cover image is removed.
select lives_ok(
  $$
    select public.update_trip_cover_image('96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null)
  $$,
  'an organizer can clear the cover image'
);

-- A regular traveler (not the creator, not an organizer) cannot set it.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '96333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"96333333-3333-4333-8333-333333333333","email":"carla@example.com","role":"authenticated"}';

select throws_ok(
  $$
    select public.update_trip_cover_image(
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sneaky.jpg'
    )
  $$,
  'P0001',
  'not_authorized',
  'a plain traveler participant cannot set the cover image'
);

-- An outsider cannot set it either.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '96444444-4444-4444-8444-444444444444';
set local request.jwt.claims = '{"sub":"96444444-4444-4444-8444-444444444444","email":"outsider@example.com","role":"authenticated"}';

select throws_ok(
  $$
    select public.update_trip_cover_image(
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/sneaky.jpg'
    )
  $$,
  'P0001',
  'not_authorized',
  'an outsider cannot set the cover image'
);

-- The cover image cannot be changed once the trip is archived.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '96111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"96111111-1111-4111-8111-111111111111","email":"ana@example.com","role":"authenticated"}';

update public.trips set archived_at = now()
where id = '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $$
    select public.update_trip_cover_image(
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '96aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/too-late.jpg'
    )
  $$,
  'P0001',
  'trip_archived',
  'the cover image is read-only once the trip is archived'
);

select * from finish();
rollback;
