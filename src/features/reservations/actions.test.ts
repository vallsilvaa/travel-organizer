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
  rpc: vi.fn(),
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
  createReservation,
  deleteReservation,
  updateReservation,
} from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const reservationId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const payerId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";

function validForm() {
  const formData = new FormData();
  formData.set("tripId", tripId);
  formData.set("reservationId", reservationId);
  formData.set("reservationType", "flight");
  formData.set("title", "Outbound flight");
  formData.set("provider", "LATAM");
  formData.set("confirmationCode", "ABC123");
  formData.set("startDate", "2026-10-12");
  formData.set("startTime", "08:00");
  formData.set("endDate", "2026-10-12");
  formData.set("endTime", "18:00");
  formData.set("location", "GRU");
  formData.set("destinationLocation", "LIS");
  formData.set("notes", "Window seat");
  return formData;
}

describe("reservation actions", () => {
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
    mocks.insert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: reservationId }, error: null }),
      }),
    });
    mocks.from.mockReturnValue({ ...builder, insert: mocks.insert });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
      rpc: mocks.rpc,
    });
  });

  it("creates a reservation for the authenticated participant", async () => {
    const result = await createReservation({}, validForm());

    expect(mocks.from).toHaveBeenCalledWith("trip_reservations");
    expect(mocks.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      reservation_type: "flight",
      title: "Outbound flight",
      provider: "LATAM",
      confirmation_code: "ABC123",
      start_date: "2026-10-12",
      start_time: "08:00",
      end_date: "2026-10-12",
      end_time: "18:00",
      location: "GRU",
      destination_location: "LIS",
      notes: "Window seat",
      itinerary_item_id: null,
      paid_amount: null,
      currency: null,
      payer_id: null,
      created_by: "user-123",
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("passes paid_amount/currency/payer through and syncs the linked expense on create (#171)", async () => {
    const formData = validForm();
    formData.set("paidAmount", "250");
    formData.set("currency", "usd");
    formData.set("payerId", payerId);

    const result = await createReservation({}, formData);

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ paid_amount: "250.00", currency: "USD", payer_id: payerId }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("sync_reservation_expense", { p_reservation_id: reservationId });
    expect(result.success).toBe(true);
  });

  it("updates only the requested reservation within its trip and re-syncs its expense", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    const result = await updateReservation({}, validForm());

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Outbound flight", reservation_type: "flight" }),
    );
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", reservationId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(mocks.rpc).toHaveBeenCalledWith("sync_reservation_expense", { p_reservation_id: reservationId });
    expect(result.success).toBe(true);
  });

  it("deletes only the requested reservation within its trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockReturnValueOnce({
      select: () => ({ maybeSingle: async () => ({ data: { title: "Outbound flight" } }) }),
    });

    await deleteReservation(validForm());

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", reservationId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });
});
