import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next-intl", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    useTranslations: (namespace?: string) => createTranslator(namespace),
    useLocale: () => "pt",
  };
});
vi.mock("next-intl/server", async () => {
  const { createFormatter, createTranslator, ptMessages } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
    getLocale: async () => "pt",
    getMessages: async () => ptMessages,
    getFormatter: async () => createFormatter(),
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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

function filteringQueryBuilder(rows: Record<string, unknown>[]) {
  let filtered = rows;
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filtered = filtered.filter((row) => row[column] === value);
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    single: () => Promise.resolve({ data: filtered[0] ?? null, error: null }),
    then: (...args: Parameters<Promise<QueryResult>["then"]>) =>
      Promise.resolve({ data: filtered, error: null }).then(...args),
  };
  return builder;
}

const invitation = {
  id: "trip-invitation-1",
  trip_id: "27823996-ec50-4cc2-8506-a29d07b86f94",
  trip_destination: "Lisbon",
  status: "pending",
  created_at: "2026-08-01T00:00:00Z",
  email: "traveler@example.com",
};

const upcomingTrip = {
  id: "11111111-1111-1111-1111-111111111111",
  destination: "Lisbon",
  start_date: "2099-01-10",
  end_date: "2099-01-20",
  updated_at: "2026-08-01T00:00:00Z",
  archived_at: null,
};

const archivedTrip = {
  id: "22222222-2222-2222-2222-222222222222",
  destination: "Buenos Aires",
  start_date: "2020-01-01",
  end_date: "2020-01-10",
  updated_at: "2026-08-05T00:00:00Z",
  archived_at: "2026-08-06T00:00:00Z",
};

afterEach(cleanup);

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "traveler@example.com" } },
    });
    mocks.rpc.mockResolvedValue({ data: [] });
    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return queryBuilder({ data: { display_name: "Traveler", task_reminders_enabled: true } });
      }
      if (table === "trips") {
        return queryBuilder({ data: [], error: null });
      }
      if (table === "trip_invitations") {
        return queryBuilder({ data: [invitation], error: null });
      }
      return queryBuilder({ data: null, error: null });
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
      rpc: mocks.rpc,
    });
  });

  it("renders every dashboard form action as a submit control", async () => {
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    const submitButtonNames = [/sair/i, /salvar preferência/i, /aceitar/i, /recusar/i, /criar viagem/i];
    for (const name of submitButtonNames) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("type")).toBe("submit");
    }
  });

  it("does not show an invitation the user sent to someone else's email as one addressed to them", async () => {
    const ownInvitation = { ...invitation, id: "own-invitation", email: "traveler@example.com" };
    const sentInvitation = {
      ...invitation,
      id: "sent-invitation",
      trip_destination: "Porto",
      email: "invitee@example.com",
    };
    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return queryBuilder({ data: { display_name: "Traveler", task_reminders_enabled: true } });
      }
      if (table === "trips") {
        return queryBuilder({ data: [], error: null });
      }
      if (table === "trip_invitations") {
        return filteringQueryBuilder([ownInvitation, sentInvitation]);
      }
      return queryBuilder({ data: null, error: null });
    });

    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Lisbon")).toBeTruthy();
    expect(screen.queryByText("Porto")).toBeNull();
  });

  describe("with trips", () => {
    beforeEach(() => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "profiles") {
          return queryBuilder({ data: { display_name: "Traveler", task_reminders_enabled: true } });
        }
        if (table === "trips") {
          return queryBuilder({ data: [upcomingTrip, archivedTrip], error: null });
        }
        if (table === "trip_invitations") {
          return queryBuilder({ data: [], error: null });
        }
        return queryBuilder({ data: null, error: null });
      });
    });

    it("excludes archived trips from the default view", async () => {
      render(await DashboardPage({ searchParams: Promise.resolve({}) }));

      expect(screen.getByText("Lisbon")).toBeTruthy();
      expect(screen.queryByText("Buenos Aires")).toBeNull();
    });

    it("formats the trip date range using the locale-aware formatter", async () => {
      render(await DashboardPage({ searchParams: Promise.resolve({}) }));

      expect(screen.getByText("10 de jan. de 2099 – 20 de jan. de 2099")).toBeTruthy();
    });

    it("shows archived trips only when that status filter is selected", async () => {
      render(await DashboardPage({ searchParams: Promise.resolve({ status: "archived" }) }));

      expect(screen.getByText("Buenos Aires")).toBeTruthy();
      expect(screen.queryByText("Lisbon")).toBeNull();
    });

    it("filters by destination search", async () => {
      render(await DashboardPage({ searchParams: Promise.resolve({ q: "lis" }) }));

      expect(screen.getByText("Lisbon")).toBeTruthy();
    });

    it("shows a clear no-results message when a search matches nothing", async () => {
      render(await DashboardPage({ searchParams: Promise.resolve({ q: "nowhere" }) }));

      expect(screen.getByText(/nenhuma viagem encontrada com esses filtros/i)).toBeTruthy();
    });

    it("shows readiness, critical, and participant stats on each trip card", async () => {
      mocks.rpc.mockResolvedValue({
        data: [
          {
            trip_id: upcomingTrip.id,
            readiness_percentage: 40,
            critical_open_count: 2,
            participant_count: 3,
          },
        ],
      });

      render(await DashboardPage({ searchParams: Promise.resolve({}) }));

      expect(screen.getByText("40% pronto")).toBeTruthy();
      expect(screen.getByText("2 críticas em aberto")).toBeTruthy();
      expect(screen.getByText("3 participantes")).toBeTruthy();
    });

    it("still shows stats for an archived trip", async () => {
      mocks.rpc.mockResolvedValue({
        data: [
          {
            trip_id: archivedTrip.id,
            readiness_percentage: 100,
            critical_open_count: 0,
            participant_count: 2,
          },
        ],
      });

      render(await DashboardPage({ searchParams: Promise.resolve({ status: "archived" }) }));

      expect(screen.getByText("100% pronto")).toBeTruthy();
      expect(screen.getByText("0 críticas em aberto")).toBeTruthy();
    });
  });
});
