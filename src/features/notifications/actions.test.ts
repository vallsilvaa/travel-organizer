import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  is: vi.fn(),
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

import { markAllNotificationsRead, markNotificationRead } from "./actions";

const notificationId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

describe("notification actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = { eq: mocks.eq, is: mocks.is };
    mocks.eq.mockReturnValue(builder);
    mocks.is.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue(builder);
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("marks a single notification read, scoped to its owner", async () => {
    await markNotificationRead(notificationId);

    expect(mocks.from).toHaveBeenCalledWith("notifications");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ read_at: expect.any(String) }),
    );
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", notificationId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "user_id", "user-123");
    expect(mocks.is).toHaveBeenCalledWith("read_at", null);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("ignores an invalid notification id without touching the database", async () => {
    await markNotificationRead("not-a-uuid");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("marks every unread notification for the current user as read", async () => {
    mocks.update.mockReturnValueOnce({ eq: mocks.eq });
    mocks.eq.mockReturnValueOnce({ is: mocks.is });

    await markAllNotificationsRead();

    expect(mocks.from).toHaveBeenCalledWith("notifications");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(mocks.is).toHaveBeenCalledWith("read_at", null);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
