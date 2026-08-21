import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
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

import { removeParticipant } from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const creatorId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const organizerId = "9c1c147b-8684-4ff1-b5c7-6814e4f57f74";

describe("removeParticipant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = {
      delete: mocks.delete,
      eq: mocks.eq,
      select: mocks.select,
      maybeSingle: mocks.maybeSingle,
    };
    mocks.delete.mockReturnValue(builder);
    mocks.eq.mockReturnValue(builder);
    mocks.select.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: creatorId, email: "creator@example.com" } },
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("removes an organizer and revalidates the trip page", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { user_id: organizerId },
      error: null,
    });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("userId", organizerId);

    await removeParticipant(formData);

    expect(mocks.from).toHaveBeenCalledWith("trip_participants");
    expect(mocks.delete).toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("trip_id", tripId);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", organizerId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("refuses to let a creator remove themselves", async () => {
    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("userId", creatorId);

    await expect(removeParticipant(formData)).rejects.toThrow(
      `NEXT_REDIRECT:/trips/${tripId}?tripError=cannot_remove_self`,
    );

    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("redirects with an error when RLS blocks the removal", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("userId", organizerId);

    await expect(removeParticipant(formData)).rejects.toThrow(
      `NEXT_REDIRECT:/trips/${tripId}?tripError=remove_participant_not_allowed`,
    );

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid ids before touching the database", async () => {
    const formData = new FormData();
    formData.set("tripId", "not-a-uuid");
    formData.set("userId", organizerId);

    await expect(removeParticipant(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/trips/not-a-uuid?tripError=invalid_participant",
    );

    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
