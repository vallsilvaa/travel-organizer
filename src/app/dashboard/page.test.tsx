import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}));
vi.mock("next-intl", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    useTranslations: (namespace?: string) => createTranslator(namespace),
    useLocale: () => "pt",
  };
});
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import DashboardPage from "./page";

type QueryResult = { data: unknown; error?: unknown };

function queryBuilder(result: QueryResult) {
  const promise = Promise.resolve(result) as Promise<QueryResult> & {
    eq: () => typeof promise;
    limit: () => typeof promise;
    order: () => typeof promise;
    select: () => typeof promise;
    single: () => Promise<QueryResult>;
  };
  promise.select = () => promise;
  promise.eq = () => promise;
  promise.order = () => promise;
  promise.limit = () => promise;
  promise.single = () => Promise.resolve(result);
  return promise;
}

afterEach(cleanup);

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "traveler@example.com" } },
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return queryBuilder({ data: { display_name: "Traveler", is_organizer: false } });
      }
      return queryBuilder({ data: [], error: null });
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("redirects an unauthenticated visitor to sign in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(DashboardPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_REDIRECT:/auth/sign-in?error=authentication_required",
    );
  });

  it("greets the signed-in traveler by name", async () => {
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Bem-vindo, Traveler")).toBeTruthy();
  });

  it("links to the profile and trips hub cards", async () => {
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /perfil/i }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("link", { name: /viagens/i }).getAttribute("href")).toBe("/trips");
  });

  it("does not show the organizer panel link for a traveler-only account", async () => {
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole("link", { name: /painel do organizador/i })).toBeNull();
  });

  it("shows the organizer panel link when the account is also an organizer", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return queryBuilder({ data: { display_name: "Traveler", is_organizer: true } });
      }
      return queryBuilder({ data: [], error: null });
    });

    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /painel do organizador/i }).getAttribute("href")).toBe(
      "/organizer",
    );
  });

  it("shows an error banner when redirected back with an error code", async () => {
    render(await DashboardPage({ searchParams: Promise.resolve({ error: "organizer_access_required" }) }));

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
