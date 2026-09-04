begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('90111111-1111-4111-8111-111111111111', 'owner@example.com'),
  ('90222222-2222-4222-8222-222222222222', 'outsider@example.com');

set local role authenticated;
set local request.jwt.claim.sub = '90111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"90111111-1111-4111-8111-111111111111","email":"owner@example.com","role":"authenticated"}';

-- An owner can create a preparation-type template.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      id, owner_id, title, item_type, category, continent, country, classification, due_offset_days
    ) values (
      '90aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '90111111-1111-4111-8111-111111111111',
      'Check passport validity',
      'preparation',
      'documents',
      'europe',
      'Portugal',
      'required',
      180
    )
  $$,
  'the owner can create a preparation template'
);

-- A document_request template without instructions is rejected.
select throws_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, continent, country, classification, due_offset_days
    ) values (
      '90111111-1111-4111-8111-111111111111',
      'Provide a visa scan',
      'document_request',
      'documents',
      'europe',
      'Portugal',
      'required',
      90
    )
  $$,
  '23514',
  null,
  'a document request without instructions is rejected'
);

-- A document_request template with instructions succeeds.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      id, owner_id, title, item_type, category, continent, country, classification, due_offset_days, document_instructions
    ) values (
      '90bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '90111111-1111-4111-8111-111111111111',
      'Provide a visa scan',
      'document_request',
      'documents',
      'europe',
      'Portugal',
      'required',
      90,
      'Upload a clear scan of your visa page.'
    )
  $$,
  'a document request with instructions succeeds'
);

-- Negative estimated amounts are rejected.
select throws_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, continent, country, classification, due_offset_days, estimated_amount
    ) values (
      '90111111-1111-4111-8111-111111111111',
      'Buy travel insurance',
      'preparation',
      'health',
      'europe',
      'Portugal',
      'required',
      90,
      -10.00
    )
  $$,
  '23514',
  null,
  'a negative estimated amount is rejected'
);

-- An out-of-range due_offset_days is rejected.
select throws_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, continent, country, classification, due_offset_days
    ) values (
      '90111111-1111-4111-8111-111111111111',
      'Too far out',
      'preparation',
      'other',
      'europe',
      'Portugal',
      'optional',
      1000
    )
  $$,
  '23514',
  null,
  'an out-of-range due_offset_days is rejected'
);

-- The owner can update their own template.
select lives_ok(
  $$
    update public.prep_item_templates
    set title = 'Check passport validity (6 months)'
    where id = '90aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'the owner can update their template'
);

reset role;

-- An outsider cannot see, edit, or delete another organizer's catalog.
set local role authenticated;
set local request.jwt.claim.sub = '90222222-2222-4222-8222-222222222222';
set local request.jwt.claims = '{"sub":"90222222-2222-4222-8222-222222222222","email":"outsider@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.prep_item_templates),
  0::bigint,
  'an outsider cannot see another organizer templates'
);

select results_eq(
  $$
    update public.prep_item_templates
    set title = 'Hijacked'
    where id = '90aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    returning id
  $$,
  $$select null::uuid where false$$,
  'an outsider cannot update another organizer template'
);

select results_eq(
  $$
    delete from public.prep_item_templates
    where id = '90aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    returning id
  $$,
  $$select null::uuid where false$$,
  'an outsider cannot delete another organizer template'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '90111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"90111111-1111-4111-8111-111111111111","email":"owner@example.com","role":"authenticated"}';

select is(
  (select count(*) from public.prep_item_templates),
  2::bigint,
  'the outsider never mutated the owner templates'
);

-- The owner can delete their own template.
select results_eq(
  $$
    delete from public.prep_item_templates
    where id = '90bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    returning id
  $$,
  $$values ('90bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)$$,
  'the owner can delete their own template'
);

select * from finish();
rollback;
