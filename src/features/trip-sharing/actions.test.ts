import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createShareLink, revokeShareLink } from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const userId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const linkId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";

function makeForm(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("createShareLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  });

  it("revokes any existing active link before creating a new one", async () => {
    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const is = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ update, eq, is, insert });

    await createShareLink(makeForm({ tripId }));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("trip_id", tripId);
    expect(is).toHaveBeenCalledWith("revoked_at", null);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: tripId, created_by: userId, token: expect.any(String) }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("generates a sufficiently random, URL-safe token", async () => {
    let insertedToken = "";
    mocks.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn((row: { token: string }) => {
        insertedToken = row.token;
        return Promise.resolve({ error: null });
      }),
    });

    await createShareLink(makeForm({ tripId }));

    expect(insertedToken.length).toBeGreaterThanOrEqual(32);
    expect(insertedToken).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a malformed trip id before contacting Supabase", async () => {
    await expect(createShareLink(makeForm({ tripId: "not-a-uuid" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("revokeShareLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  });

  it("revokes the specific link, scoped to its trip", async () => {
    const eq = vi.fn().mockReturnThis();
    const update = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ update });

    await revokeShareLink(makeForm({ tripId, linkId }));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("id", linkId);
    expect(eq).toHaveBeenCalledWith("trip_id", tripId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("rejects a malformed link id before contacting Supabase", async () => {
    await expect(revokeShareLink(makeForm({ tripId, linkId: "not-a-uuid" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
