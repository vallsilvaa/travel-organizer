import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
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

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import {
  createItineraryItem,
  deleteItineraryItem,
  updateItineraryItem,
} from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const itemId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

function validForm() {
  const formData = new FormData();
  formData.set("tripId", tripId);
  formData.set("itemId", itemId);
  formData.set("date", "2026-10-12");
  formData.set("time", "09:30");
  formData.set("title", "Museum visit");
  formData.set("location", "Central Museum");
  formData.set("notes", "Bring the tickets");
  formData.set("period", "morning");
  return formData;
}

describe("itinerary actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = {
      delete: mocks.delete,
      eq: mocks.eq,
      update: mocks.update,
    };
    mocks.delete.mockReturnValue(builder);
    mocks.eq.mockReturnValue(builder);
    mocks.update.mockReturnValue(builder);
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ ...builder, insert: mocks.insert });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("creates an itinerary item for the authenticated participant", async () => {
    const result = await createItineraryItem({}, validForm());

    expect(mocks.from).toHaveBeenCalledWith("itinerary_items");
    expect(mocks.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      item_date: "2026-10-12",
      start_time: "09:30",
      title: "Museum visit",
      location: "Central Museum",
      notes: "Bring the tickets",
      period: "morning",
      created_by: "user-123",
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("updates only the requested item within its trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    const result = await updateItineraryItem({}, validForm());

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Museum visit", item_date: "2026-10-12" }),
    );
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", itemId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(result.success).toBe(true);
  });

  it("deletes only the requested item within its trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    await deleteItineraryItem(validForm());

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", itemId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });
});
