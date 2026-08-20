grant update (destination, start_date, end_date, updated_at)
  on table public.trips to authenticated;
grant delete on table public.trips to authenticated;

create policy "Trip creators can update their trips"
on public.trips
for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy "Trip creators can delete their trips"
on public.trips
for delete
to authenticated
using (created_by = (select auth.uid()));
