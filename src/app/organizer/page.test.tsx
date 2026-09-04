import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));
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
    or: () => builder,
    maybeSingle: async () => result,
    then: (...args: Parameters<Promise<typeof result>["then"]>) =>
      Promise.resolve(result).then(...args),
  };
  return builder;
}

afterEach(cleanup);

describe("OrganizerPage access guard", () => {
  it("redirects an unauthenticated visitor to sign in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: () => queryBuilder({ data: null }),
    });

    await expect(OrganizerPage()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/sign-in?error=authentication_required",
    );
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

    await expect(OrganizerPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?error=organizer_access_required",
    );
  });
});

describe("OrganizerPage content", () => {
  function mockOrganizerData({
    trips = [],
    templates = [],
    tripsError = null,
    templatesError = null,
  }: {
    trips?: { id: string; destination: string; start_date: string; end_date: string | null }[];
    templates?: unknown[];
    tripsError?: unknown;
    templatesError?: unknown;
  }) {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      rpc: () => Promise.resolve({ data: [] }),
      from: (table: string) => {
        if (table === "profiles") {
          return queryBuilder({ data: { is_traveler: false, is_organizer: true } });
        }
        if (table === "trip_participants") {
          return queryBuilder({ data: [] });
        }
        if (table === "trips") {
          return queryBuilder({ data: trips, error: tripsError });
        }
        if (table === "prep_item_templates") {
          return queryBuilder({ data: templates, error: templatesError });
        }
        throw new Error(`unexpected table ${table}`);
      },
    });
  }

  it("shows the primary actions and an empty state when there are no managed trips", async () => {
    mockOrganizerData({});

    render(await OrganizerPage());

    expect(screen.getByRole("button", { name: "Criar Nova Viagem" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Criar Nova Tarefa" })).toBeTruthy();
    expect(screen.getByText(/Você ainda não organiza nenhuma viagem/)).toBeTruthy();
  });

  it("renders a managed trip as a link to its existing trip page", async () => {
    mockOrganizerData({
      trips: [{ id: "trip-1", destination: "Roma", start_date: "2027-09-10", end_date: "2027-09-20" }],
    });

    render(await OrganizerPage());

    const link = screen.getByRole("link", { name: /Roma/ });
    expect(link.getAttribute("href")).toBe("/trips/trip-1");
  });

  it("shows a load error banner when the trips query fails", async () => {
    mockOrganizerData({ tripsError: { message: "boom" } });

    render(await OrganizerPage());

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
