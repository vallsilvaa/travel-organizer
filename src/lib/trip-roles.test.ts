import { describe, expect, it } from "vitest";

import { getTripRoleAudience } from "./trip-roles";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const creatorId = "11111111-1111-4111-8111-111111111111";
const organizerId = "22222222-2222-4222-8222-222222222222";
const travelerId = "33333333-3333-4333-8333-333333333333";

function fakeSupabase(participants: { user_id: string; role: string }[]) {
  return {
    from(table: string) {
      if (table === "trips") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { created_by: creatorId } }),
            }),
          }),
        };
      }
      if (table === "trip_participants") {
        return {
          select: () => ({
            eq: async () => ({ data: participants }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("getTripRoleAudience", () => {
  it("always counts the trip creator as an organizer even though their row says traveler", async () => {
    const supabase = fakeSupabase([
      { user_id: creatorId, role: "traveler" },
      { user_id: organizerId, role: "organizer" },
      { user_id: travelerId, role: "traveler" },
    ]);

    const audience = await getTripRoleAudience(supabase, tripId);

    expect(audience.organizerIds.sort()).toEqual([creatorId, organizerId].sort());
    expect(audience.travelerIds).toEqual([travelerId]);
  });

  it("excludes the creator from the traveler list even without an explicit organizer row", async () => {
    const supabase = fakeSupabase([
      { user_id: creatorId, role: "traveler" },
      { user_id: travelerId, role: "traveler" },
    ]);

    const audience = await getTripRoleAudience(supabase, tripId);

    expect(audience.organizerIds).toEqual([creatorId]);
    expect(audience.travelerIds).toEqual([travelerId]);
  });
});
