import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
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

import { convertPrepTaskOnCompletion, createTask, setTaskCompletion, updatePrepTripItem, updateTask } from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const taskId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const ownerId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";

function validForm() {
  const formData = new FormData();
  formData.set("tripId", tripId);
  formData.set("taskId", taskId);
  formData.set("title", "Book airport transfer");
  formData.set("ownerId", ownerId);
  formData.set("dueDate", "2026-10-10");
  formData.set("category", "transport");
  formData.set("isCritical", "on");
  formData.set("referenceLabel", "Transfer voucher");
  formData.set("referenceUrl", "https://example.com/transfer");
  return formData;
}

describe("task actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = { eq: mocks.eq, single: mocks.single, update: mocks.update };
    mocks.eq.mockReturnValue(builder);
    mocks.update.mockReturnValue(builder);
    mocks.insert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: taskId }, error: null }),
      }),
    });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ ...builder, insert: mocks.insert, select: mocks.from });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
      rpc: mocks.rpc,
    });
  });

  it("creates a shared task", async () => {
    const result = await createTask({}, validForm());

    expect(mocks.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      title: "Book airport transfer",
      owner_id: ownerId,
      due_date: "2026-10-10",
      due_offset_days: null,
      category: "transport",
      is_critical: true,
      reference_label: "Transfer voucher",
      reference_url: "https://example.com/transfer",
      created_by: "user-123",
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("edits only a task from the selected trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    const result = await updateTask({}, validForm());

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Book airport transfer", owner_id: ownerId }),
    );
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", taskId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(result.success).toBe(true);
  });

  it("completes a task through the complete_prep_item RPC", async () => {
    const formData = validForm();
    formData.set("completed", "true");

    await setTaskCompletion(formData);

    expect(mocks.rpc).toHaveBeenCalledWith("complete_prep_item", {
      p_task_id: taskId,
      p_should_complete: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("reopens a completed task through the complete_prep_item RPC", async () => {
    const formData = validForm();
    formData.set("completed", "false");

    await setTaskCompletion(formData);

    expect(mocks.rpc).toHaveBeenCalledWith("complete_prep_item", {
      p_task_id: taskId,
      p_should_complete: false,
    });
  });

  it("recomputes the due date and saves a governed item's fields", async () => {
    mocks.single.mockResolvedValueOnce({ data: { start_date: "2027-09-10" } });

    const formData = validForm();
    formData.set("itemType", "preparation");
    formData.set("continent", "europe");
    formData.set("country", "Portugal");
    formData.set("classification", "required");
    formData.set("dueOffsetDays", "10");
    formData.set("assignedTo", ownerId);
    formData.set("itineraryItemId", "none");

    const result = await updatePrepTripItem({}, formData);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "required",
        is_critical: true,
        due_offset_days: 10,
        due_date: "2027-08-31",
        owner_id: ownerId,
        itinerary_item_id: null,
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("convertPrepTaskOnCompletion", () => {
  const itineraryItemId = "22222222-2222-4222-8222-222222222222";
  const reservationId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
      rpc: mocks.rpc,
    });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  function mockTables({
    reservationInsert,
    itineraryInsert,
    taskUpdate,
  }: {
    reservationInsert: (values: Record<string, unknown>) => void;
    itineraryInsert: (values: Record<string, unknown>) => void;
    taskUpdate: (values: Record<string, unknown>) => void;
  }) {
    mocks.from.mockImplementation((table: string) => {
      if (table === "trip_tasks") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: taskId, title: "Buy Lion King tickets", itinerary_item_id: null, reservation_id: null },
                }),
              }),
            }),
          }),
          update: (values: Record<string, unknown>) => {
            taskUpdate(values);
            return { eq: () => ({ eq: async () => ({ error: null }) }) };
          },
        };
      }
      if (table === "trips") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { start_date: "2027-06-10", end_date: "2027-06-20" } }),
            }),
          }),
        };
      }
      if (table === "itinerary_items") {
        return {
          insert: (values: Record<string, unknown>) => {
            itineraryInsert(values);
            return { select: () => ({ single: async () => ({ data: { id: itineraryItemId }, error: null }) }) };
          },
        };
      }
      if (table === "trip_reservations") {
        return {
          insert: (values: Record<string, unknown>) => {
            reservationInsert(values);
            return { select: () => ({ single: async () => ({ data: { id: reservationId }, error: null }) }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
  }

  it("creates an itinerary item and a linked reservation, and stamps both ids back on the task", async () => {
    const reservationInsert = vi.fn();
    const itineraryInsert = vi.fn();
    const taskUpdate = vi.fn();
    mockTables({ reservationInsert, itineraryInsert, taskUpdate });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("taskId", taskId);
    formData.set("addItinerary", "true");
    formData.set("addReservation", "true");
    formData.set("title", "Buy Lion King tickets");
    formData.set("location", "London");
    formData.set("date", "2027-06-15");
    formData.set("reservationType", "tickets");
    formData.set("startDate", "2027-06-15");
    formData.set("paidAmount", "150");
    formData.set("currency", "GBP");
    formData.set("paymentStatus", "paid");
    formData.set("responsibleIds", ownerId);

    const result = await convertPrepTaskOnCompletion({}, formData);

    expect(result.success).toBe(true);
    expect(itineraryInsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: tripId, item_date: "2027-06-15", title: "Buy Lion King tickets", location: "London" }),
    );
    expect(reservationInsert).toHaveBeenCalledWith(
      expect.objectContaining({ itinerary_item_id: itineraryItemId, title: "Buy Lion King tickets" }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("sync_reservation_expense", {
      p_reservation_id: reservationId,
      p_responsible_ids: [ownerId],
    });
    expect(taskUpdate).toHaveBeenCalledWith({ itinerary_item_id: itineraryItemId, reservation_id: reservationId });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_prep_item", {
      p_task_id: taskId,
      p_should_complete: true,
    });
  });

  it("still marks the task complete when neither checkbox is set (e.g. Pular)", async () => {
    const reservationInsert = vi.fn();
    const itineraryInsert = vi.fn();
    const taskUpdate = vi.fn();
    mockTables({ reservationInsert, itineraryInsert, taskUpdate });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("taskId", taskId);

    const result = await convertPrepTaskOnCompletion({}, formData);

    expect(result.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("complete_prep_item", {
      p_task_id: taskId,
      p_should_complete: true,
    });
    expect(itineraryInsert).not.toHaveBeenCalled();
    expect(reservationInsert).not.toHaveBeenCalled();
  });

  it("rejects an itinerary date outside the trip's range", async () => {
    const reservationInsert = vi.fn();
    const itineraryInsert = vi.fn();
    const taskUpdate = vi.fn();
    mockTables({ reservationInsert, itineraryInsert, taskUpdate });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("taskId", taskId);
    formData.set("addItinerary", "true");
    formData.set("title", "Buy Lion King tickets");
    formData.set("date", "2027-07-01");

    const result = await convertPrepTaskOnCompletion({}, formData);

    expect(result.itineraryErrors?.date).toBeTruthy();
    expect(itineraryInsert).not.toHaveBeenCalled();
  });
});
