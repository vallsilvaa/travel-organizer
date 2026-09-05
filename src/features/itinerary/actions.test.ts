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
  tripSingle: vi.fn(),
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

vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    fn();
  },
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
  formData.set("city", "Lisbon");
  return formData;
}

describe("itinerary actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const itemsBuilder = {
      delete: mocks.delete,
      eq: mocks.eq,
      update: mocks.update,
      insert: mocks.insert,
    };
    mocks.delete.mockReturnValue(itemsBuilder);
    mocks.eq.mockReturnValue(itemsBuilder);
    mocks.update.mockReturnValue(itemsBuilder);
    mocks.insert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: itemId }, error: null }),
      }),
    });
    mocks.tripSingle.mockResolvedValue({
      data: { start_date: "2026-10-01", end_date: "2026-10-20" },
      error: null,
    });
    const tripsBuilder = {
      select: () => ({ eq: () => ({ single: mocks.tripSingle }) }),
    };
    mocks.from.mockImplementation((table: string) => (table === "trips" ? tripsBuilder : itemsBuilder));
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
      city: "Lisbon",
      created_by: "user-123",
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("rejects a new item dated outside the trip's date range (#171)", async () => {
    const formData = validForm();
    formData.set("date", "2026-11-01");

    const result = await createItineraryItem({}, formData);

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(result.errors?.date).toBeTruthy();
  });

  it("accepts an item dated on the start_date of a trip with no end_date (#171)", async () => {
    mocks.tripSingle.mockResolvedValue({
      data: { start_date: "2026-10-12", end_date: null },
      error: null,
    });

    const formData = validForm();
    formData.set("date", "2026-10-12");
    const result = await createItineraryItem({}, formData);
    expect(result.success).toBe(true);
  });

  it("rejects an item dated after the start_date of a trip with no end_date (#171)", async () => {
    mocks.tripSingle.mockResolvedValue({
      data: { start_date: "2026-10-12", end_date: null },
      error: null,
    });

    const formData = validForm();
    formData.set("date", "2026-10-13");
    const result = await createItineraryItem({}, formData);
    expect(result.errors?.date).toBeTruthy();
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

  it("rejects updating an item to a date outside the trip's date range (#171)", async () => {
    const formData = validForm();
    formData.set("date", "2026-09-30");

    const result = await updateItineraryItem({}, formData);

    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.errors?.date).toBeTruthy();
  });

  it("deletes only the requested item within its trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockReturnValueOnce({
      select: () => ({ maybeSingle: async () => ({ data: { title: "Museum visit" } }) }),
    });

    await deleteItineraryItem(validForm());

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", itemId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });
});
