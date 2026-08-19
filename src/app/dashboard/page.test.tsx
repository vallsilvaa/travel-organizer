import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import DashboardPage from "./page";

type QueryResult = { data: unknown; error?: unknown };

function queryBuilder(result: QueryResult) {
  const promise = Promise.resolve(result) as Promise<QueryResult> & {
    eq: () => typeof promise;
    order: () => typeof promise;
    select: () => typeof promise;
    single: () => Promise<QueryResult>;
  };
  promise.select = () => promise;
  promise.eq = () => promise;
  promise.order = () => promise;
  promise.single = () => Promise.resolve(result);
  return promise;
}

const invitation = {
  id: "trip-invitation-1",
  trip_id: "27823996-ec50-4cc2-8506-a29d07b86f94",
  trip_destination: "Lisbon",
  status: "pending",
  created_at: "2026-08-01T00:00:00Z",
};

afterEach(cleanup);

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "traveler@example.com" } },
    });
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
});
