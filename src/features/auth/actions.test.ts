import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  select: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  update: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "http://localhost:3000" }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import {
  changePassword,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUp,
  updateDisplayName,
} from "./actions";
import { postSignInPath } from "./post-sign-in-path";

describe("authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.maybeSingle.mockResolvedValue({ data: { is_traveler: true, is_organizer: false } });
    mocks.select.mockReturnValue({ eq: () => ({ maybeSingle: mocks.maybeSingle }) });
    mocks.from.mockReturnValue({ update: mocks.update, select: mocks.select });
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        signOut: mocks.signOut,
        signUp: mocks.signUp,
        resetPasswordForEmail: mocks.resetPasswordForEmail,
        updateUser: mocks.updateUser,
        getUser: mocks.getUser,
      },
      from: mocks.from,
    });
  });

  it("creates an account and redirects an authenticated user", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    const formData = new FormData();
    formData.set("displayName", "Valeria");
    formData.set("email", "VALERIA@example.com");
    formData.set("password", "safe-pass-123");
    formData.set("passwordConfirmation", "safe-pass-123");

    await expect(signUp(formData)).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "valeria@example.com",
      password: "safe-pass-123",
      options: {
        data: { display_name: "Valeria" },
        emailRedirectTo: "http://localhost:3000/auth/callback?next=/dashboard",
      },
    });
  });

  it("signs in with normalized credentials and sends a traveler-only account to the dashboard", async () => {
    const formData = new FormData();
    formData.set("email", "VALERIA@example.com");
    formData.set("password", "safe-pass-123");

    await expect(signIn(formData)).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "valeria@example.com",
      password: "safe-pass-123",
    });
  });

  it("sends an organizer-only account straight to the organizer panel", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { is_traveler: false, is_organizer: true } });
    const formData = new FormData();
    formData.set("email", "organizer@example.com");
    formData.set("password", "safe-pass-123");

    await expect(signIn(formData)).rejects.toThrow("NEXT_REDIRECT:/organizer");
  });

  it("sends a dual-role account to the mode selector", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { is_traveler: true, is_organizer: true } });
    const formData = new FormData();
    formData.set("email", "both@example.com");
    formData.set("password", "safe-pass-123");

    await expect(signIn(formData)).rejects.toThrow("NEXT_REDIRECT:/auth/choose-mode");
  });

  it("signs out and returns to sign in", async () => {
    mocks.signOut.mockResolvedValue({ error: null });

    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/auth/sign-in");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("requests a password reset email with a redirect to the reset page", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("email", "VALERIA@example.com");

    await expect(requestPasswordReset(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/auth/forgot-password?message=check_email_reset",
    );
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("valeria@example.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=/auth/reset-password",
    });
  });

  it("shows the same generic message even when the account does not exist", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      error: { status: 400, message: "User not found" },
    });
    const formData = new FormData();
    formData.set("email", "nobody@example.com");

    await expect(requestPasswordReset(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/auth/forgot-password?message=check_email_reset",
    );
  });

  it("shows a distinct message when the reset request is rate limited", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { status: 429 } });
    const formData = new FormData();
    formData.set("email", "valeria@example.com");

    await expect(requestPasswordReset(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/auth/forgot-password?error=rate_limited",
    );
  });

  it("resets the password, ends the recovery session, and redirects to sign in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("password", "new-safe-pass");
    formData.set("passwordConfirmation", "new-safe-pass");

    await expect(resetPassword(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/auth/sign-in?message=password_updated",
    );
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-safe-pass" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("rejects an expired or missing recovery session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const formData = new FormData();
    formData.set("password", "new-safe-pass");
    formData.set("passwordConfirmation", "new-safe-pass");

    await expect(resetPassword(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/auth/forgot-password?error=reset_link_invalid",
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords before calling Supabase", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const formData = new FormData();
    formData.set("password", "new-safe-pass");
    formData.set("passwordConfirmation", "different-pass");

    await expect(resetPassword(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/auth/reset-password?error=password_mismatch",
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("lets a signed-in user change their password from the dashboard", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.updateUser.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("password", "new-safe-pass");
    formData.set("passwordConfirmation", "new-safe-pass");

    await expect(changePassword(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?passwordMessage=password_updated",
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("requires authentication to change the password", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const formData = new FormData();
    formData.set("password", "new-safe-pass");
    formData.set("passwordConfirmation", "new-safe-pass");

    await expect(changePassword(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/auth/sign-in?error=authentication_required",
    );
  });

  it("lets a signed-in user update their display name", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const formData = new FormData();
    formData.set("displayName", "  Nova Viajante  ");

    await expect(updateDisplayName(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?profileMessage=profile_updated",
    );
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "Nova Viajante" }),
    );
    expect(mocks.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("rejects a display name that is too short", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const formData = new FormData();
    formData.set("displayName", "A");

    await expect(updateDisplayName(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?profileError=invalid_display_name",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("shows an error when the profile update fails", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.eq.mockResolvedValue({ error: { message: "boom" } });
    const formData = new FormData();
    formData.set("displayName", "Valeria");

    await expect(updateDisplayName(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?profileError=profile_update_failed",
    );
  });

  it("requires authentication to update the display name", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const formData = new FormData();
    formData.set("displayName", "Valeria");

    await expect(updateDisplayName(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/auth/sign-in?error=authentication_required",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("postSignInPath", () => {
  it("sends a traveler-only profile to the dashboard", () => {
    expect(postSignInPath({ is_traveler: true, is_organizer: false })).toBe("/dashboard");
  });

  it("sends an organizer-only profile to the organizer panel", () => {
    expect(postSignInPath({ is_traveler: false, is_organizer: true })).toBe("/organizer");
  });

  it("sends a dual-role profile to the mode selector", () => {
    expect(postSignInPath({ is_traveler: true, is_organizer: true })).toBe("/auth/choose-mode");
  });

  it("falls back to the dashboard when there is no role at all", () => {
    expect(postSignInPath({ is_traveler: false, is_organizer: false })).toBe("/dashboard");
  });

  it("falls back to the dashboard when the profile could not be loaded", () => {
    expect(postSignInPath(null)).toBe("/dashboard");
  });
});
