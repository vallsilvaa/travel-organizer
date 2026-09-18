-- #208 split a governed prep item's flat title into an optional action
-- (Comprar/Reservar/Confirmar/Validar/Renovar/Agendar) + a clean title, but
-- only ever applied that shape going forward - every prep item (trip_tasks)
-- and catalog template (prep_item_templates) created before that change
-- still has action = null and the verb baked into the title, e.g. "Reservar
-- transporte do aeroporto" (that exact phrase was the form's own
-- placeholder, so it's a common real shape).
--
-- One-time, best-effort backfill: only touches rows that still have
-- action is null AND whose title starts with exactly one of the six known
-- Portuguese action verbs followed by more text. Anything else (a
-- different verb like "Verificar", no verb at all, or a verb with nothing
-- after it) is left completely untouched - this is intentionally
-- conservative rather than guessing.
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

with verb_map(action_value, verb) as (
  values
    ('buy', 'Comprar'),
    ('book', 'Reservar'),
    ('confirm', 'Confirmar'),
    ('validate', 'Validar'),
    ('renew', 'Renovar'),
    ('schedule', 'Agendar')
),
template_matches as (
  select pt.id, vm.action_value, vm.verb
  from public.prep_item_templates pt
  join verb_map vm on pt.title ilike vm.verb || ' %'
  where pt.action is null
    and length(trim(substring(pt.title from length(vm.verb) + 2))) > 0
)
update public.prep_item_templates pt
set action = m.action_value,
    title = trim(substring(pt.title from length(m.verb) + 2))
from template_matches m
where pt.id = m.id;
