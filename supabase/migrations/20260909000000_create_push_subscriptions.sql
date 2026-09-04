-- Issue #146: web push as a delivery channel. Having a row here *is* the
-- opt-in signal (per device/browser) - there's no separate boolean
-- preference to keep in sync, since revoking access is just deleting the
-- subscription. Both endpoint and (user_id, endpoint) are unique: the same
-- browser subscription can only ever belong to one account at a time, and
-- a user can't accumulate duplicate rows for the same device.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 2000),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon;

grant select, insert, update (p256dh, auth, last_seen_at), delete
  on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;

create policy "Users can view their own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can refresh their own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (user_id = (select auth.uid()));
