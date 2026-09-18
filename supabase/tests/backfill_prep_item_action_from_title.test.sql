-- The migration itself (20260918000000_backfill_prep_item_action_from_title.sql)
-- runs against an empty database in CI, so it never has any pre-existing
-- rows to actually transform there - this test instead inserts "old
-- format" rows here and now, then re-runs the exact same transformation
-- query to verify the matching/splitting logic itself is correct.

begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('9e111111-1111-4111-8111-111111111111', 'organizer@example.com');

insert into public.trips (id, title, destination, start_date, end_date, created_by) values (
  '9eaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Trip', 'Rome', '2027-09-10', '2027-09-20',
  '9e111111-1111-4111-8111-111111111111'
);

insert into public.trip_tasks (id, trip_id, created_by, title, category, action) values
  ('9e000001-0000-4000-8000-000000000001', '9eaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '9e111111-1111-4111-8111-111111111111', 'Comprar ingresso do museu', 'documents', null),
  ('9e000001-0000-4000-8000-000000000002', '9eaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '9e111111-1111-4111-8111-111111111111', 'reservar mesa para jantar', 'documents', null),
  ('9e000001-0000-4000-8000-000000000003', '9eaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '9e111111-1111-4111-8111-111111111111', 'Verificar validade do passaporte', 'documents', null),
  ('9e000001-0000-4000-8000-000000000004', '9eaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '9e111111-1111-4111-8111-111111111111', 'Confirmar', 'documents', null),
  ('9e000001-0000-4000-8000-000000000005', '9eaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '9e111111-1111-4111-8111-111111111111', 'Confirmar rounds', 'documents', 'buy');

-- The exact same transformation the migration applies.
with verb_map(action_value, verb) as (
  values
    ('buy', 'Comprar'),
    ('book', 'Reservar'),
    ('confirm', 'Confirmar'),
    ('validate', 'Validar'),
    ('renew', 'Renovar'),
    ('schedule', 'Agendar')
),
trip_task_matches as (
  select t.id, vm.action_value, vm.verb
  from public.trip_tasks t
  join verb_map vm on t.title ilike vm.verb || ' %'
  where t.action is null
    and length(trim(substring(t.title from length(vm.verb) + 2))) > 0
)
update public.trip_tasks t
set action = m.action_value,
    title = trim(substring(t.title from length(m.verb) + 2))
from trip_task_matches m
where t.id = m.id;

select results_eq(
  $$select action, title from public.trip_tasks where id = '9e000001-0000-4000-8000-000000000001'$$,
  $$values ('buy'::text, 'ingresso do museu'::text)$$,
  'a title starting with a known verb is split into action + clean title'
);

select results_eq(
  $$select action, title from public.trip_tasks where id = '9e000001-0000-4000-8000-000000000002'$$,
  $$values ('book'::text, 'mesa para jantar'::text)$$,
  'the verb match is case-insensitive'
);

select results_eq(
  $$select action, title from public.trip_tasks where id = '9e000001-0000-4000-8000-000000000003'$$,
  $$values (null::text, 'Verificar validade do passaporte'::text)$$,
  'a title starting with an unrecognized verb is left untouched'
);

select results_eq(
  $$select action, title from public.trip_tasks where id = '9e000001-0000-4000-8000-000000000004'$$,
  $$values (null::text, 'Confirmar'::text)$$,
  'a bare verb with nothing after it is left untouched'
);

select results_eq(
  $$select action, title from public.trip_tasks where id = '9e000001-0000-4000-8000-000000000005'$$,
  $$values ('buy'::text, 'Confirmar rounds'::text)$$,
  'a row that already has an action is never touched, even if its title also starts with a verb'
);

select * from finish();
rollback;
