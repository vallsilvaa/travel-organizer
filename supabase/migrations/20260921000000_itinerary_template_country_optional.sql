-- #231 (Roteiro v2, R04): the "Novo item de roteiro" modal upserts a
-- reusable prep_item_templates row (item_type = 'itinerary_item') straight
-- from the modal's own fields - Atividade+Título, Data, Horário,
-- Período, Endereço, Distância aproximada, Local (city), Observações (D9).
-- There's no "país" field in that modal (itinerary_items itself has no
-- country concept either, see validation.ts), so country - still `not
-- null` on this table since 20260904000000_create_prep_item_templates.sql -
-- must become optional for this item_type, mirroring how `continent` was
-- already relaxed for the same reason in
-- 20260907000000_remodel_prep_item_catalog.sql. The organizer's own
-- TemplateForm still collects (and keeps requiring) a country for every
-- item_type, itinerary_item included - this only lets a *different* creation
-- path skip it.
alter table public.prep_item_templates
  alter column country drop not null;

alter table public.prep_item_templates
  add constraint prep_item_templates_country_required_unless_itinerary check (
    item_type = 'itinerary_item' or country is not null
  );
