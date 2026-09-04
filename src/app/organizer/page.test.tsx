import { describe, expect, it, vi } from "vitest";

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
  const { createFormatter, createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
    getFormatter: async () => createFormatter(),
  };
});

import OrganizerPage from "./page";

function queryBuilder(result: { data: unknown; error?: unknown }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: async () => result,
    then: (...args: Parameters<Promise<typeof result>["then"]>) =>
      Promise.resolve(result).then(...args),
  };
  return builder;
}

describe("OrganizerPage access guard", () => {
  it("redirects an unauthenticated visitor to sign in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: () => queryBuilder({ data: null }),
    });

    await expect(
      OrganizerPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/auth/sign-in?error=authentication_required");
  });

  it("redirects an authenticated non-organizer back to the dashboard", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: (table: string) =>
        table === "profiles"
          ? queryBuilder({ data: { is_traveler: true, is_organizer: false } })
          : queryBuilder({ data: [] }),
    });

    await expect(
      OrganizerPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard?error=organizer_access_required");
  });
});
