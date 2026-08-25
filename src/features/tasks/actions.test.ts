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
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import { createTask, setTaskCompletion, updateTask } from "./actions";

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
    const builder = { eq: mocks.eq, update: mocks.update };
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

  it("completes and attributes a task to the current user", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });
    const formData = validForm();
    formData.set("completed", "true");

    await setTaskCompletion(formData);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ completed_by: "user-123" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("reopens a completed task", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });
    const formData = validForm();
    formData.set("completed", "false");

    await setTaskCompletion(formData);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ completed_at: null, completed_by: null }),
    );
  });
});
