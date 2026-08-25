import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-intl", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    useTranslations: (namespace?: string) => createTranslator(namespace),
    useLocale: () => "pt",
  };
});
vi.mock("next-intl/server", async () => {
  const { createTranslator, ptMessages } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
    getLocale: async () => "pt",
    getMessages: async () => ptMessages,
  };
});

import ResetPasswordPage from "./page";

afterEach(cleanup);

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  });

  it("renders the reset form for a valid recovery session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));

    const button = screen.getByRole("button", { name: /salvar nova senha/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("redirects to request a new link when there is no recovery session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(
      ResetPasswordPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/auth/forgot-password?error=reset_link_invalid",
    );
  });
});
