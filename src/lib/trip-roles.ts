import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type TripRoleAudience = {
  organizerIds: string[];
  travelerIds: string[];
};

// The trip creator's own trip_participants row is always role='traveler'
// (see the add_trip_creator_as_participant trigger) even though the
// creator is functionally always an organizer - every recipient
// computation in the app re-derives this same "created_by OR
// role='organizer'" rule ad hoc. This is the one shared place for it.
export async function getTripRoleAudience(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripRoleAudience> {
  const [{ data: trip }, { data: participants }] = await Promise.all([
    supabase.from("trips").select("created_by").eq("id", tripId).single(),
    supabase.from("trip_participants").select("user_id, role").eq("trip_id", tripId),
  ]);

  const createdBy = (trip as { created_by: string } | null)?.created_by ?? null;
  const rows = (participants ?? []) as { user_id: string; role: string }[];

  const organizerIds = new Set<string>();
  if (createdBy) {
    organizerIds.add(createdBy);
  }
  for (const row of rows) {
    if (row.role === "organizer") {
      organizerIds.add(row.user_id);
    }
  }

  const travelerIds = rows
    .filter((row) => row.role === "traveler" && row.user_id !== createdBy)
    .map((row) => row.user_id);

  return { organizerIds: [...organizerIds], travelerIds };
}
