import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}));

import { sendPushToUser } from "./push";

const userId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";

function fakeSupabase(subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[]) {
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: async () => ({ data: subscriptions }),
      }),
      delete: () => ({ eq: deleteEq }),
    })),
    deleteEq,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any & { deleteEq: typeof deleteEq };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = "public-key";
  process.env.VAPID_PRIVATE_KEY = "private-key";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("sendPushToUser", () => {
  it("does nothing when VAPID is not configured", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const supabase = fakeSupabase([{ id: "sub-1", endpoint: "https://push.example/1", p256dh: "p", auth: "a" }]);

    await sendPushToUser(supabase, userId, { title: "t", body: "b", url: "/dashboard" });

    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no subscriptions", async () => {
    const supabase = fakeSupabase([]);

    await sendPushToUser(supabase, userId, { title: "t", body: "b", url: "/dashboard" });

    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("sends a notification to every subscription", async () => {
    mocks.sendNotification.mockResolvedValue(undefined);
    const supabase = fakeSupabase([
      { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
      { id: "sub-2", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2" },
    ]);

    await sendPushToUser(supabase, userId, { title: "Overdue", body: "1 task", url: "/dashboard" });

    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example/1", keys: { p256dh: "p1", auth: "a1" } },
      JSON.stringify({ title: "Overdue", body: "1 task", url: "/dashboard" }),
    );
  });

  it("deletes an expired subscription (410 Gone) without throwing", async () => {
    mocks.sendNotification.mockRejectedValue({ statusCode: 410 });
    const supabase = fakeSupabase([{ id: "sub-1", endpoint: "https://push.example/1", p256dh: "p", auth: "a" }]);

    await expect(
      sendPushToUser(supabase, userId, { title: "t", body: "b", url: "/dashboard" }),
    ).resolves.toBeUndefined();

    expect(supabase.deleteEq).toHaveBeenCalledWith("id", "sub-1");
  });

  it("logs but does not throw or delete on a non-gone delivery failure", async () => {
    mocks.sendNotification.mockRejectedValue({ statusCode: 500 });
    const supabase = fakeSupabase([{ id: "sub-1", endpoint: "https://push.example/1", p256dh: "p", auth: "a" }]);

    await expect(
      sendPushToUser(supabase, userId, { title: "t", body: "b", url: "/dashboard" }),
    ).resolves.toBeUndefined();

    expect(supabase.deleteEq).not.toHaveBeenCalled();
  });
});
