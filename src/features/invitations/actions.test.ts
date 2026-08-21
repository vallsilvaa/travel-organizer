import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
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
  cancelInvitation,
  inviteOrganizer,
  resendInvitation,
  respondToInvitation,
} from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const invitationId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

describe("invitation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("REMINDER_EMAIL_FROM", "Travel Organizer <no-reply@example.com>");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://travel.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "email-1" }) }));

    const builder = {
      eq: mocks.eq,
      insert: mocks.insert,
      select: mocks.select,
      single: mocks.single,
      maybeSingle: mocks.maybeSingle,
      update: mocks.update,
    };
    mocks.eq.mockReturnValue(builder);
    mocks.select.mockReturnValue(builder);
    mocks.update.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "traveler@example.com" } },
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates a pending organizer invitation by email and sends the branded email", async () => {
    mocks.single.mockResolvedValue({
      data: { id: tripId, destination: "London" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({
      data: { display_name: "Ana" },
      error: null,
    });
    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("email", " Organizer@Example.com ");

    const result = await inviteOrganizer({}, formData);

    expect(mocks.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      trip_destination: "London",
      email: "organizer@example.com",
      invited_by: "user-123",
      role: "organizer",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.message).toBe("Convite enviado para organizer@example.com.");
  });

  it("still creates the invitation when email delivery fails", async () => {
    mocks.single.mockResolvedValue({
      data: { id: tripId, destination: "London" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("email", "organizer@example.com");

    const result = await inviteOrganizer({}, formData);

    expect(result.message).toBe(
      "Convite criado para organizer@example.com, mas não foi possível enviar o e-mail agora. Você pode reenviar em instantes.",
    );
  });

  it("accepts a pending invitation and opens the shared trip", async () => {
    mocks.single.mockResolvedValue({ data: { trip_id: tripId }, error: null });
    const formData = new FormData();
    formData.set("invitationId", invitationId);
    formData.set("response", "accepted");

    await expect(respondToInvitation(formData)).rejects.toThrow(
      `NEXT_REDIRECT:/trips/${tripId}`,
    );

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
        invited_user_id: "user-123",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("resends a pending invitation and re-sends the email", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: { email: "organizer@example.com", trip_destination: "London" },
        error: null,
      })
      .mockResolvedValueOnce({ data: { display_name: "Ana" }, error: null });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("invitationId", invitationId);

    await resendInvitation(formData);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ expires_at: expect.any(String) }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("redirects when resending an invitation that is no longer pending", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("invitationId", invitationId);

    await expect(resendInvitation(formData)).rejects.toThrow(
      `NEXT_REDIRECT:/trips/${tripId}?tripError=resend_invitation_not_allowed`,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancels a pending invitation", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: invitationId }, error: null });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("invitationId", invitationId);

    await cancelInvitation(formData);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled", responded_at: expect.any(String) }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("redirects when cancelling an invitation that is no longer pending", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("invitationId", invitationId);

    await expect(cancelInvitation(formData)).rejects.toThrow(
      `NEXT_REDIRECT:/trips/${tripId}?tripError=cancel_invitation_not_allowed`,
    );
  });
});
