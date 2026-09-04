begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('96111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('96222222-2222-4222-8222-222222222222', 'bob@example.com');

set local role authenticated;
set local request.jwt.claim.sub = '96111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"96111111-1111-4111-8111-111111111111","email":"alice@example.com","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('96111111-1111-4111-8111-111111111111', 'https://push.example/alice-device', 'p256dh-value', 'auth-value')
  $$,
  'a user can create their own push subscription'
);

select throws_ok(
  $$
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('96111111-1111-4111-8111-111111111111', 'https://push.example/alice-device', 'other', 'other')
  $$,
  '23505',
  null,
  'the same endpoint cannot be subscribed twice'
);

select throws_ok(
  $$
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('96222222-2222-4222-8222-222222222222', 'https://push.example/on-behalf-of-bob', 'p', 'a')
  $$,
  '42501',
  null,
  'a user cannot create a subscription for someone else'
);

select is(
  (select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/alice-device'),
  1,
  'the owner can see their own subscription'
);

reset role;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (
  '96222222-2222-4222-8222-222222222222', 'https://push.example/bob-device', 'p', 'a'
);

set local role authenticated;
set local request.jwt.claim.sub = '96111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"96111111-1111-4111-8111-111111111111","email":"alice@example.com","role":"authenticated"}';

select is(
  (select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/bob-device'),
  0,
  'RLS hides another user''s push subscription'
);

select lives_ok(
  $$delete from public.push_subscriptions where endpoint = 'https://push.example/alice-device'$$,
  'a user can revoke (delete) their own subscription'
);

select * from finish();
rollback;
