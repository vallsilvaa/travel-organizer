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

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createComment, deleteComment, updateComment } from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const itemId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const commentId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";

function validForm() {
  const formData = new FormData();
  formData.set("tripId", tripId);
  formData.set("itemId", itemId);
  formData.set("itemType", "itinerary");
  formData.set("commentId", commentId);
  formData.set("body", "Meet by the main entrance.");
  return formData;
}

describe("comment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = { delete: mocks.delete, eq: mocks.eq, update: mocks.update };
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

  it("adds a comment to an itinerary item", async () => {
    const result = await createComment({}, validForm());

    expect(mocks.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      item_type: "itinerary",
      itinerary_item_id: itemId,
      task_id: null,
      body: "Meet by the main entrance.",
      author_id: "user-123",
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("updates only a comment owned by the current user", async () => {
    mocks.eq
      .mockReturnValueOnce({ eq: mocks.eq })
      .mockReturnValueOnce({ eq: mocks.eq })
      .mockResolvedValueOnce({ error: null });

    const result = await updateComment({}, validForm());

    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", commentId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(mocks.eq).toHaveBeenNthCalledWith(3, "author_id", "user-123");
    expect(result.success).toBe(true);
  });

  it("deletes only a comment owned by the current user", async () => {
    mocks.eq
      .mockReturnValueOnce({ eq: mocks.eq })
      .mockReturnValueOnce({ eq: mocks.eq })
      .mockResolvedValueOnce({ error: null });

    await deleteComment(validForm());

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenNthCalledWith(3, "author_id", "user-123");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("rejects empty comments before contacting Supabase", async () => {
    const formData = validForm();
    formData.set("body", " ");

    const result = await createComment({}, formData);

    expect(result.error).toBe("Informe um comentário com até 2.000 caracteres.");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
