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
  remove: vi.fn(),
  revalidatePath: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
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

import { deleteAttachment, uploadAttachment } from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const attachmentId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

function makeFile(name: string, type: string, size: number) {
  const file = new File([new Uint8Array(Math.min(size, 16))], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function validForm() {
  const formData = new FormData();
  formData.set("tripId", tripId);
  formData.set("itemType", "");
  formData.set("itemId", "");
  formData.set("file", makeFile("passport.pdf", "application/pdf", 1024));
  return formData;
}

describe("attachment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = { delete: mocks.delete, eq: mocks.eq };
    mocks.delete.mockReturnValue(builder);
    mocks.eq.mockReturnValue(builder);
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ ...builder, insert: mocks.insert });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.storageFrom.mockReturnValue({ upload: mocks.upload, remove: mocks.remove });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
      storage: { from: mocks.storageFrom },
    });
  });

  it("uploads a file and records its metadata", async () => {
    const result = await uploadAttachment({}, validForm());

    expect(mocks.storageFrom).toHaveBeenCalledWith("trip-attachments");
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${tripId}/.+-passport\\.pdf$`)),
      expect.any(File),
      { contentType: "application/pdf" },
    );
    expect(mocks.from).toHaveBeenCalledWith("trip_attachments");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: tripId,
        item_type: null,
        item_id: null,
        file_name: "passport.pdf",
        content_type: "application/pdf",
        size_bytes: 1024,
        created_by: "user-123",
      }),
    );
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("rejects an unsupported file type before touching storage", async () => {
    const formData = validForm();
    formData.set("file", makeFile("archive.zip", "application/zip", 1024));

    const result = await uploadAttachment({}, formData);

    expect(mocks.upload).not.toHaveBeenCalled();
    expect(result.success).toBeUndefined();
    expect(result.message).toBeTruthy();
  });

  it("removes the uploaded file if recording its metadata fails", async () => {
    mocks.insert.mockResolvedValueOnce({ error: { message: "boom" } });

    const result = await uploadAttachment({}, validForm());

    expect(mocks.remove).toHaveBeenCalledWith([
      expect.stringMatching(new RegExp(`^${tripId}/.+-passport\\.pdf$`)),
    ]);
    expect(result.success).toBeUndefined();
  });

  it("deletes the metadata row and the storage object", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });
    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("attachmentId", attachmentId);
    formData.set("storagePath", `${tripId}/some-file.pdf`);

    await deleteAttachment(formData);

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", attachmentId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(mocks.remove).toHaveBeenCalledWith([`${tripId}/some-file.pdf`]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });
});
