begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('93111111-1111-4111-8111-111111111111', 'newuser@example.com'),
  ('93222222-2222-4222-8222-222222222222', 'other@example.com');

-- handle_new_user() should have fired on the auth.users insert above,
-- defaulting every new account to traveler-only.
select is(
  (select is_traveler from public.profiles where id = '93111111-1111-4111-8111-111111111111'),
  true,
  'a new account defaults to is_traveler = true'
);

select is(
  (select is_organizer from public.profiles where id = '93111111-1111-4111-8111-111111111111'),
  false,
  'a new account defaults to is_organizer = false'
);

set local role authenticated;
set local request.jwt.claim.sub = '93111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"93111111-1111-4111-8111-111111111111","email":"newuser@example.com","role":"authenticated"}';

-- The Server Action path (creating a trip) needs to be able to flip its
-- own is_organizer flag.
select lives_ok(
  $$ update public.profiles set is_organizer = true where id = '93111111-1111-4111-8111-111111111111' $$,
  'an authenticated user can update their own is_organizer flag'
);

select is(
  (select is_organizer from public.profiles where id = '93111111-1111-4111-8111-111111111111'),
  true,
  'the update took effect'
);

-- is_traveler has no write path yet - only the migration's default/backfill
-- ever sets it - so it is deliberately excluded from the update grant.
select throws_ok(
  $$ update public.profiles set is_traveler = false where id = '93111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'is_traveler cannot be written by authenticated (no grant on that column)'
);

-- RLS still restricts writes to the caller's own row, same as every other
-- self-editable profile column.
select results_eq(
  $$
    update public.profiles
    set is_organizer = true
    where id = '93222222-2222-4222-8222-222222222222'
    returning id
  $$,
  $$select null::uuid where false$$,
  'an authenticated user cannot update another user''s is_organizer flag'
);

select * from finish();
rollback;
