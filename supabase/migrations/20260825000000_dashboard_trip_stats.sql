-- Aggregates readiness/critical/participant stats for every trip the caller
-- can see in a single query, so the dashboard doesn't need one round trip
-- per trip card as the list grows. Readiness and "critical open" mirror the
-- exact rule already used on the trip page's own Preparação tab (readiness/
-- criticalOpenCount in src/app/trips/[tripId]/page.tsx): percentage of
-- completed tasks, rounded, 0 when a trip has no tasks yet; critical open
-- tasks are is_critical and not yet completed.
create function public.get_dashboard_trip_stats()
returns table (
  trip_id uuid,
  readiness_percentage integer,
  critical_open_count bigint,
  participant_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    trips.id as trip_id,
    case
      when count(tasks.id) = 0 then 0
      else round(count(tasks.id) filter (where tasks.completed_at is not null) * 100.0 / count(tasks.id))::int
    end as readiness_percentage,
    count(tasks.id) filter (where tasks.is_critical and tasks.completed_at is null) as critical_open_count,
    coalesce(participants.participant_count, 0) as participant_count
  from public.trips trips
  left join public.trip_tasks tasks on tasks.trip_id = trips.id
  left join (
    select trip_id, count(*) as participant_count
    from public.trip_participants
    group by trip_id
  ) participants on participants.trip_id = trips.id
  where private.is_trip_participant(trips.id, auth.uid())
  group by trips.id, participants.participant_count;
$$;

revoke execute on function public.get_dashboard_trip_stats()
  from public, anon;
grant execute on function public.get_dashboard_trip_stats()
  to authenticated;
