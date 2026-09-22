begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('99311111-1111-4111-8111-111111111111', 'elena@example.com');

set local role authenticated;
set local request.jwt.claim.sub = '99311111-1111-4111-8111-111111111111';
set local request.jwt.claims = '{"sub":"99311111-1111-4111-8111-111111111111","email":"elena@example.com","role":"authenticated"}';

-- #231: the "Novo item de roteiro" modal has no country field (D9), so an
-- itinerary_item template it creates must be allowed to omit one.
select lives_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, classification, city, location
    ) values (
      '99311111-1111-4111-8111-111111111111',
      'Visitar o Jardim Botânico',
      'itinerary_item',
      'other',
      'recommended',
      'Porto',
      'Rua do Campo Alegre'
    )
  $$,
  'an itinerary_item template can be saved without a country'
);

-- Every other item_type still requires one - country is nullable at the
-- column level now, so this is a check violation (23514), not a not_null
-- one (23502).
select throws_ok(
  $$
    insert into public.prep_item_templates (
      owner_id, title, item_type, category, classification, due_offset_days
    ) values (
      '99311111-1111-4111-8111-111111111111',
      'Check passport validity',
      'preparation',
      'documents',
      'required',
      180
    )
  $$,
  '23514',
  null,
  'a preparation template still requires a country'
);

select * from finish();
rollback;
