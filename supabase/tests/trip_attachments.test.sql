begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('a2222222-2222-4222-8222-222222222222', 'organizer@example.com'),
  ('a3333333-3333-4333-8333-333333333333', 'outsider@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa',
  'Bangkok',
  '2027-11-01',
  '2027-11-10',
  'a1111111-1111-4111-8111-111111111111'
);

insert into public.trip_participants (trip_id, user_id, role) values (
  'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa',
  'a2222222-2222-4222-8222-222222222222',
  'organizer'
);

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

-- The trip creator can record attachment metadata for their own trip.
select lives_ok(
  $$
    insert into public.trip_attachments (trip_id, storage_path, file_name, content_type, size_bytes, created_by)
    values (
      'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/boarding-pass.pdf',
      'boarding-pass.pdf',
      'application/pdf',
      1024,
      'a1111111-1111-4111-8111-111111111111'
    )
  $$,
  'a trip participant can record an attachment'
);

select throws_ok(
  $$
    insert into public.trip_attachments (trip_id, item_type, storage_path, file_name, content_type, size_bytes, created_by)
    values (
      'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa', 'itinerary',
      'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/missing-item-id.pdf',
      'missing-item-id.pdf', 'application/pdf', 1024, 'a1111111-1111-4111-8111-111111111111'
    )
  $$,
  '23514',
  null,
  'item_type without a matching item_id is rejected'
);

-- A fellow participant can view and upload storage objects for the trip.
set local request.jwt.claim.sub = 'a2222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"a2222222-2222-4222-8222-222222222222","email":"organizer@example.com","role":"authenticated"}';

select isnt_empty(
  $$select id from public.trip_attachments where trip_id = 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'a fellow participant can view the attachment metadata'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner)
    values ('trip-attachments', 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/passport-scan.png', 'a2222222-2222-4222-8222-222222222222')
  $$,
  'a participant can upload a storage object into their trip folder'
);

select isnt_empty(
  $$select name from storage.objects where bucket_id = 'trip-attachments' and name like 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/%'$$,
  'a participant can list storage objects in their trip folder'
);

-- An outsider (not a participant) cannot see, upload, or record attachments.
set local request.jwt.claim.sub = 'a3333333-3333-4333-8333-333333333333';
set local request.jwt.claims = '{"sub":"a3333333-3333-4333-8333-333333333333","email":"outsider@example.com","role":"authenticated"}';

select is_empty(
  $$select id from public.trip_attachments where trip_id = 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'an outsider cannot see any attachment metadata for the trip'
);

select is_empty(
  $$select name from storage.objects where bucket_id = 'trip-attachments' and name like 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/%'$$,
  'an outsider cannot list storage objects in the trip folder'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner)
    values ('trip-attachments', 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/sneaky.pdf', 'a3333333-3333-4333-8333-333333333333')
  $$,
  '42501',
  null,
  'an outsider cannot upload into the trip folder'
);

select throws_ok(
  $$
    insert into public.trip_attachments (trip_id, storage_path, file_name, content_type, size_bytes, created_by)
    values (
      'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/sneaky.pdf',
      'sneaky.pdf', 'application/pdf', 1024, 'a3333333-3333-4333-8333-333333333333'
    )
  $$,
  '42501',
  null,
  'an outsider cannot record attachment metadata for the trip'
);

-- Archiving the trip freezes new attachments but keeps existing ones
-- readable and removable is blocked too, mirroring other planning content.
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"a1111111-1111-4111-8111-111111111111","email":"creator@example.com","role":"authenticated"}';

update public.trips set archived_at = now() where id = 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa';

select isnt_empty(
  $$select id from public.trip_attachments where trip_id = 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'attachment metadata remains readable on an archived trip'
);

select throws_ok(
  $$
    insert into public.trip_attachments (trip_id, storage_path, file_name, content_type, size_bytes, created_by)
    values (
      'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/late-upload.pdf',
      'late-upload.pdf', 'application/pdf', 1024, 'a1111111-1111-4111-8111-111111111111'
    )
  $$,
  '42501',
  null,
  'attachment metadata cannot be recorded on an archived trip'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner)
    values ('trip-attachments', 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaaaaaa/late-upload.pdf', 'a1111111-1111-4111-8111-111111111111')
  $$,
  '42501',
  null,
  'storage uploads are blocked on an archived trip'
);

select * from finish();
rollback;
