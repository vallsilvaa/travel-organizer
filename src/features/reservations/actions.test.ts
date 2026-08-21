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

import {
  createReservation,
  deleteReservation,
  updateReservation,
} from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const reservationId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

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
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ ...builder, insert: mocks.insert });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
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
      created_by: "user-123",
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("updates only the requested reservation within its trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    const result = await updateReservation({}, validForm());

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Outbound flight", reservation_type: "flight" }),
    );
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", reservationId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(result.success).toBe(true);
  });

  it("deletes only the requested reservation within its trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    await deleteReservation(validForm());

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", reservationId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });
});
