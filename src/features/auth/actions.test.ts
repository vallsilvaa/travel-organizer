import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
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

import { signIn, signOut, signUp } from "./actions";

describe("authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        signOut: mocks.signOut,
        signUp: mocks.signUp,
      },
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

  it("signs in with normalized credentials", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.set("email", "VALERIA@example.com");
    formData.set("password", "safe-pass-123");

    await expect(signIn(formData)).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "valeria@example.com",
      password: "safe-pass-123",
    });
  });

  it("signs out and returns to sign in", async () => {
    mocks.signOut.mockResolvedValue({ error: null });

    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/auth/sign-in");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
