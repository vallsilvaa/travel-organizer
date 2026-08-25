import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/realtime/realtime-status", () => ({
  RealtimeStatus: () => null,
}));

import TripPage from "./page";

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

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const userId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

const trip = {
  id: tripId,
  destination: "Lisbon",
  start_date: "2026-09-01",
  end_date: "2026-09-10",
  created_at: "2026-08-01T00:00:00Z",
  created_by: userId,
  timezone: "UTC",
  archived_at: null,
};

const task = {
  id: "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9",
  title: "Check passport validity",
  owner_id: null,
  due_date: null,
  due_offset_days: null,
  completed_at: null,
  created_at: "2026-08-01T00:00:00Z",
  category: "documents" as const,
  is_critical: false,
  template_key: null,
  reference_label: null,
  reference_url: null,
};

afterEach(cleanup);

describe("TripPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } });
    mocks.rpc.mockResolvedValue({ data: [] });
    mocks.from.mockImplementation((table: string) => {
      if (table === "trips") {
        return queryBuilder({ data: trip, error: null });
      }
      if (table === "trip_tasks") {
        return queryBuilder({ data: [task], error: null });
      }
      if (table === "itinerary_items") {
        return queryBuilder({ data: [], error: null });
      }
      if (table === "item_comments") {
        return queryBuilder({ data: [], error: null });
      }
      if (table === "trip_expenses") {
        return queryBuilder({ data: [], error: null });
      }
      if (table === "trip_expense_shares") {
        return queryBuilder({ data: [], error: null });
      }
      if (table === "trip_invitations") {
        return queryBuilder({ data: [], error: null });
      }
      return queryBuilder({ data: null, error: null });
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
      rpc: mocks.rpc,
    });
  });

  it("renders the preparation tab's direct action buttons as submit controls", async () => {
    render(
      await TripPage({
        params: Promise.resolve({ tripId }),
        // Forces the preparation tab to mount by default (Base UI Tabs
        // unmounts inactive panels), so its buttons are queryable.
        searchParams: Promise.resolve({ status: "open" }),
      }),
    );

    const addChecklistButton = screen.getByRole("button", { name: /adicionar checklist da inglaterra/i });
    expect(addChecklistButton.getAttribute("type")).toBe("submit");

    const completeButton = screen.getByRole("button", { name: /concluir/i });
    expect(completeButton.getAttribute("type")).toBe("submit");
  });

  it("shows edit and confirmed deletion controls to the creator", async () => {
    render(await TripPage({
      params: Promise.resolve({ tripId }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByText("Editar dados da viagem")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Excluir viagem" }));
    expect(screen.getByRole("heading", { name: "Excluir esta viagem?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir viagem" }).getAttribute("type")).toBe("submit");
  });

  it("does not show trip management controls to another participant", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "22222222-2222-2222-2222-222222222222" } } });

    render(await TripPage({
      params: Promise.resolve({ tripId }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.queryByText("Editar dados da viagem")).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir viagem" })).toBeNull();
  });

  describe("days-remaining countdown", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("counts down the days until an upcoming trip", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.getByText("Faltam 12 dias para a viagem")).toBeTruthy();
    });

    it("uses the singular for exactly one day left", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-31T12:00:00Z"));

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.getByText("Falta 1 dia para a viagem")).toBeTruthy();
    });

    it("shows an in-progress label while the trip is under way", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.getByText("A viagem está em andamento")).toBeTruthy();
    });

    it("hides the countdown once the trip has ended", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.queryByText(/faltam|falta 1 dia|em andamento/i)).toBeNull();
    });
  });

  describe("preparation quick filters", () => {
    const criticalTask = { ...task, id: "11111111-1111-1111-1111-111111111111", title: "Critical task", is_critical: true, due_date: null };
    const overdueTask = { ...task, id: "22222222-2222-2222-2222-222222222222", title: "Overdue task", is_critical: false, due_date: "2026-08-01" };
    const plainTask = { ...task, id: "33333333-3333-3333-3333-333333333333", title: "Plain task", is_critical: false, due_date: null };

    beforeEach(() => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") {
          return queryBuilder({ data: [criticalTask, overdueTask, plainTask], error: null });
        }
        if (table === "itinerary_items") return queryBuilder({ data: [], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-25T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows only critical tasks when the critical quick filter is active", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ critical: "1" }),
      }));

      expect(screen.getByText("Critical task")).toBeTruthy();
      expect(screen.queryByText("Overdue task")).toBeNull();
      expect(screen.queryByText("Plain task")).toBeNull();
    });

    it("shows only overdue tasks when the overdue quick filter is active", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ overdue: "1" }),
      }));

      expect(screen.getByText("Overdue task")).toBeTruthy();
      expect(screen.queryByText("Critical task")).toBeNull();
      expect(screen.queryByText("Plain task")).toBeNull();
    });

    it("combines a quick filter with the existing category filter", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ category: "documents", critical: "1" }),
      }));

      expect(screen.getByText("Critical task")).toBeTruthy();
      expect(screen.queryByText("Overdue task")).toBeNull();
    });

    it("marks the active quick filter chip as pressed and links preserve state", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ critical: "1" }),
      }));

      const criticalChip = screen.getByRole("link", { name: "Só críticas" });
      expect(criticalChip.getAttribute("aria-pressed")).toBe("true");
      expect(criticalChip.getAttribute("href")).toContain("critical=1");

      const overdueChip = screen.getByRole("link", { name: "Em atraso" });
      expect(overdueChip.getAttribute("aria-pressed")).toBe("false");
      expect(overdueChip.getAttribute("href")).toContain("overdue=1");
      expect(overdueChip.getAttribute("href")).toContain("critical=1");
    });
  });
});
