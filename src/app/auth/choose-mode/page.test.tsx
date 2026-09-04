import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import ChooseModePage from "./page";

function mockProfile(data: unknown) {
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data }),
        }),
      }),
    }),
  });
}

afterEach(cleanup);

describe("ChooseModePage", () => {
  it("redirects an unauthenticated visitor to sign in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mockProfile(null);

    await expect(ChooseModePage()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/sign-in?error=authentication_required",
    );
  });

  it("redirects a traveler-only account to the dashboard", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfile({ is_traveler: true, is_organizer: false });

    await expect(ChooseModePage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects an organizer-only account to the organizer panel", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfile({ is_traveler: false, is_organizer: true });

    await expect(ChooseModePage()).rejects.toThrow("NEXT_REDIRECT:/organizer");
  });

  it("shows both options for a dual-role account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfile({ is_traveler: true, is_organizer: true });

    render(await ChooseModePage());

    expect(screen.getByRole("link", { name: /organizer view/i }).getAttribute("href")).toBe("/organizer");
    expect(screen.getByRole("link", { name: /traveler view/i }).getAttribute("href")).toBe("/dashboard");
  });
});
