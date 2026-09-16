-- #208: split the flat "title" of a governed prep item into an optional
-- structured "action" (Comprar, Reservar, Confirmar...) shown as a prefix in
-- the UI, while "title" keeps meaning exactly what it already means (the
-- clean "what" - e.g. "Peca Rei Leao") so every existing reader of `.title`
-- (notifications, comments, attachments, search) needs no changes at all.
alter table public.prep_item_templates
  add column action text check (
    action is null or action in ('buy', 'book', 'confirm', 'validate', 'renew', 'schedule')
  );

alter table public.trip_tasks
  add column action text check (
    action is null or action in ('buy', 'book', 'confirm', 'validate', 'renew', 'schedule')
  );

grant update (action) on table public.trip_tasks to authenticated;
