import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendEmail: vi.fn(),
  sendPushToUser: vi.fn(),
}));

vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/push", () => ({ sendPushToUser: mocks.sendPushToUser }));

import { notifyTripCollaborators } from "./collaboration";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const organizerId = "11111111-1111-4111-8111-111111111111";
const travelerId = "22222222-2222-4222-8222-222222222222";
const otherTravelerId = "33333333-3333-4333-8333-333333333333";

function fakeSupabase(overrides: {
  claimResult?: string | null;
  participants?: { user_id: string; role: string }[];
  emailRows?: { user_id: string; email: string | null; collaboration_emails_enabled: boolean }[];
}) {
  const {
    claimResult = "event-1",
    participants = [
      { user_id: organizerId, role: "traveler" }, // creator, always organizer
      { user_id: travelerId, role: "traveler" },
      { user_id: otherTravelerId, role: "traveler" },
    ],
    emailRows = [],
  } = overrides;

  return {
    rpc: vi.fn((fn: string) => {
      if (fn === "claim_collaboration_notification_event") {
        return Promise.resolve({ data: claimResult, error: null });
      }
      if (fn === "create_collaboration_notifications") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === "get_trip_participant_emails") {
        return Promise.resolve({ data: emailRows, error: null });
      }
      throw new Error(`unexpected rpc ${fn}`);
    }),
    from: vi.fn((table: string) => {
      if (table === "trips") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { created_by: organizerId, destination: "Paris" } }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { display_name: "Ana" } }),
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
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  mocks.sendEmail.mockResolvedValue({ success: true, messageId: "email-1" });
  mocks.sendPushToUser.mockResolvedValue(undefined);
});

describe("notifyTripCollaborators", () => {
  it("notifies travelers when the organizer (trip creator) makes a change", async () => {
    const supabase = fakeSupabase({
      emailRows: [
        { user_id: travelerId, email: "traveler@example.com", collaboration_emails_enabled: true },
        { user_id: otherTravelerId, email: "other@example.com", collaboration_emails_enabled: true },
      ],
    });

    await notifyTripCollaborators({
      supabase,
      tripId,
      actorId: organizerId,
      entityType: "itinerary_item",
      entityId: "item-1",
      action: "created",
      itemLabel: "Museu do Louvre",
      tab: "itinerary",
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_collaboration_notifications",
      expect.objectContaining({
        p_trip_id: tripId,
        p_recipient_ids: expect.arrayContaining([travelerId, otherTravelerId]),
        p_notification_type: "item_created",
      }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("sends a push notification to every recipient, regardless of the email preference", async () => {
    const supabase = fakeSupabase({
      emailRows: [
        { user_id: travelerId, email: "traveler@example.com", collaboration_emails_enabled: false },
        { user_id: otherTravelerId, email: "other@example.com", collaboration_emails_enabled: true },
      ],
    });

    await notifyTripCollaborators({
      supabase,
      tripId,
      actorId: organizerId,
      entityType: "itinerary_item",
      entityId: "item-1",
      action: "created",
      itemLabel: "Museu do Louvre",
      tab: "itinerary",
    });

    expect(mocks.sendPushToUser).toHaveBeenCalledWith(
      supabase,
      travelerId,
      expect.objectContaining({ url: `/trips/${tripId}?tab=itinerary` }),
    );
    expect(mocks.sendPushToUser).toHaveBeenCalledWith(
      supabase,
      otherTravelerId,
      expect.objectContaining({ url: `/trips/${tripId}?tab=itinerary` }),
    );
  });

  it("notifies the organizer when a traveler makes a change, excluding the actor", async () => {
    const supabase = fakeSupabase({
      emailRows: [{ user_id: organizerId, email: "organizer@example.com", collaboration_emails_enabled: true }],
    });

    await notifyTripCollaborators({
      supabase,
      tripId,
      actorId: travelerId,
      entityType: "trip_expense",
      entityId: "expense-1",
      action: "updated",
      itemLabel: "Jantar",
      tab: "expenses",
    });

    const call = supabase.rpc.mock.calls.find(
      ([fn]: [string]) => fn === "create_collaboration_notifications",
    );
    expect(call[1].p_recipient_ids).toEqual([organizerId]);
    expect(call[1].p_recipient_ids).not.toContain(travelerId);
  });

  it("skips delivery when the event was already claimed (retry)", async () => {
    const supabase = fakeSupabase({ claimResult: null });

    await notifyTripCollaborators({
      supabase,
      tripId,
      actorId: organizerId,
      entityType: "trip_task",
      entityId: "task-1",
      action: "created",
      itemLabel: "Reservar hotel",
      tab: "preparation",
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "claim_collaboration_notification_event",
      expect.anything(),
    );
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("does not email recipients who disabled collaboration emails", async () => {
    const supabase = fakeSupabase({
      emailRows: [
        { user_id: travelerId, email: "traveler@example.com", collaboration_emails_enabled: false },
      ],
    });

    await notifyTripCollaborators({
      supabase,
      tripId,
      actorId: organizerId,
      entityType: "item_comment",
      entityId: "comment-1",
      action: "created",
      itemLabel: "Que legal!",
      tab: "itinerary",
    });

    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("never throws when the RPC layer fails", async () => {
    const supabase = fakeSupabase({});
    supabase.rpc = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: organizerId,
        entityType: "reservation",
        entityId: "res-1",
        action: "deleted",
        itemLabel: "Voo TAP",
        tab: "itinerary",
      }),
    ).resolves.toBeUndefined();
  });
});
