import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { updateReminderPreference } from "./actions";

describe("updateReminderPreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("enables task reminders for the signed-in user", async () => {
    const formData = new FormData();
    formData.set("taskRemindersEnabled", "on");

    await updateReminderPreference(formData);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ task_reminders_enabled: true }),
    );
    expect(mocks.eq).toHaveBeenCalledWith("id", "user-123");
  });

  it("disables task reminders when the checkbox is cleared", async () => {
    await updateReminderPreference(new FormData());

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ task_reminders_enabled: false }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
