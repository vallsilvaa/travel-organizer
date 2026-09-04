begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('94111111-1111-4111-8111-111111111111', 'organizer@example.com');

insert into public.trips (id, destination, start_date, end_date, created_by) values (
  '94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rome', '2027-09-10', '2027-09-20', '94111111-1111-4111-8111-111111111111'
);

set local role authenticated;
set local request.jwt.claim.sub = '94111111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"94111111-1111-4111-8111-111111111111","email":"organizer@example.com","role":"authenticated"}';

-- itinerary_item is now a valid catalog item_type (#149).
select lives_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, country, city, classification
    ) values (
      '94111111-1111-4111-8111-111111111111',
      'Visit the Colosseum',
      'itinerary_item',
      'experiences',
      'Italy',
      'Rome',
      'recommended'
    )
  $$,
  'an itinerary_item template can be created without a continent or a lead time'
);

-- continent is now optional for every item type.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, country, classification, due_offset_days
    ) values (
      '94111111-1111-4111-8111-111111111111',
      'Buy travel insurance',
      'preparation',
      'health',
      'Italy',
      'required',
      30
    )
  $$,
  'continent can be omitted on any template'
);

-- due_offset_days must come from the fixed lead-time set going forward.
select throws_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, country, classification, due_offset_days
    ) values (
      '94111111-1111-4111-8111-111111111111',
      'Bad lead time',
      'preparation',
      'other',
      'Italy',
      'optional',
      45
    )
  $$,
  '23514',
  null,
  'a lead time outside the fixed set (180/120/90/60/30/7/1) is rejected'
);

-- ...but is still required for "preparação para viagem".
select throws_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, country, classification
    ) values (
      '94111111-1111-4111-8111-111111111111',
      'Missing lead time',
      'preparation',
      'other',
      'Italy',
      'optional'
    )
  $$,
  '23514',
  null,
  'a preparation template without a lead time is rejected'
);

-- document_request does not need a lead time at all.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, country, classification, document_instructions
    ) values (
      '94111111-1111-4111-8111-111111111111',
      'Provide visa scan',
      'document_request',
      'documents',
      'Italy',
      'required',
      'Upload a clear scan of your visa page.'
    )
  $$,
  'a document_request template does not require a lead time'
);

-- Applying a preparation template (as an organizer) into trip_tasks no
-- longer needs a continent either - only country.
select lives_ok(
  $$
    insert into public.trip_tasks (
      trip_id, title, item_type, category, country, classification, due_offset_days, created_by
    ) values (
      '94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Buy travel insurance',
      'preparation',
      'health',
      'Italy',
      'required',
      30,
      '94111111-1111-4111-8111-111111111111'
    )
  $$,
  'a governed trip_tasks row no longer requires a continent, only a country'
);

select * from finish();
rollback;
