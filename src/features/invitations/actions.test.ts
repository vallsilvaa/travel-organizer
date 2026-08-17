import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import { inviteOrganizer, respondToInvitation } from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const invitationId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

describe("invitation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = {
      eq: mocks.eq,
      insert: mocks.insert,
      select: mocks.select,
      single: mocks.single,
      update: mocks.update,
    };
    mocks.eq.mockReturnValue(builder);
    mocks.select.mockReturnValue(builder);
    mocks.update.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "traveler@example.com" } },
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("creates a pending organizer invitation by email", async () => {
    mocks.single.mockResolvedValue({
      data: { id: tripId, destination: "London" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("email", " Organizer@Example.com ");

    const result = await inviteOrganizer({}, formData);

    expect(mocks.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      trip_destination: "London",
      email: "organizer@example.com",
      invited_by: "user-123",
      role: "organizer",
    });
    expect(result.message).toBe("Invitation sent to organizer@example.com.");
  });

  it("accepts a pending invitation and opens the shared trip", async () => {
    mocks.single.mockResolvedValue({ data: { trip_id: tripId }, error: null });
    const formData = new FormData();
    formData.set("invitationId", invitationId);
    formData.set("response", "accepted");

    await expect(respondToInvitation(formData)).rejects.toThrow(
      `NEXT_REDIRECT:/trips/${tripId}`,
    );

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
        invited_user_id: "user-123",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });
});
