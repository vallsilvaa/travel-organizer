begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('a2222222-2222-4222-8222-222222222222', 'organizer@example.com');

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

-- A user can rename themselves.
select lives_ok(
  $$update public.profiles set display_name = 'New Name' where id = 'a1111111-1111-4111-8111-111111111111'$$,
  'a user can update their own display name'
);

select is(
  (select display_name from public.profiles where id = 'a1111111-1111-4111-8111-111111111111'),
  'New Name',
  'the display name was actually updated'
);

-- A user cannot rename someone else, even by targeting the row directly.
select results_eq(
  $$
    with attempt as (
      update public.profiles set display_name = 'Hijacked'
      where id = 'a2222222-2222-4222-8222-222222222222'
      returning id
    )
    select count(*) from attempt
  $$,
  $$values (0::bigint)$$,
  'a user cannot rename a different profile'
);

-- The update grant no longer includes id or created_at - column privilege
-- is checked before RLS even runs, so this raises a permission error
-- (42501) rather than silently no-op-ing.
select throws_ok(
  $$update public.profiles set id = 'a2222222-2222-4222-8222-222222222222' where id = 'a1111111-1111-4111-8111-111111111111'$$,
  '42501',
  null,
  'a user cannot change their own profile id'
);

select throws_ok(
  $$update public.profiles set created_at = now() where id = 'a1111111-1111-4111-8111-111111111111'$$,
  '42501',
  null,
  'a user cannot change their own profile created_at'
);

select * from finish();
rollback;
