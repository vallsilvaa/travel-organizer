import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  destination_guide_content: null,
  destination_guide_source: null,
  destination_guide_reviewed_at: null,
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

    const completeButton = screen.getByRole("button", { name: /concluir/i });
    expect(completeButton.getAttribute("type")).toBe("submit");
  });

  it("shows the catalog task actions to the creator and not the England checklist button", async () => {
    render(
      await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "preparation" }),
      }),
    );

    expect(screen.getByRole("button", { name: "Add Tarefa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Criar Tarefa" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /checklist da inglaterra/i })).toBeNull();
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

      // The active chip's href toggles the filter back off.
      const criticalChip = screen.getByRole("link", { name: "Só críticas" });
      expect(criticalChip.getAttribute("aria-current")).toBe("true");
      expect(criticalChip.getAttribute("href")).not.toContain("critical=1");

      // The inactive chip's href turns it on while preserving the active one.
      const overdueChip = screen.getByRole("link", { name: "Em atraso" });
      expect(overdueChip.getAttribute("aria-current")).toBeNull();
      expect(overdueChip.getAttribute("href")).toContain("overdue=1");
      expect(overdueChip.getAttribute("href")).toContain("critical=1");
    });
  });

  describe("expense grouping views", () => {
    const participants = [
      { user_id: "11111111-1111-1111-1111-111111111111", display_name: "Ana", role: "organizer" },
      { user_id: "22222222-2222-2222-2222-222222222222", display_name: "Bruno", role: "traveler" },
    ];
    const lodgingExpense = {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      description: "Hotel",
      amount: "500.00",
      currency: "EUR",
      category: "lodging",
      expense_date: "2026-09-02",
      payer_id: participants[0].user_id,
    };
    const foodExpense = {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      description: "Jantar",
      amount: "80.00",
      currency: "EUR",
      category: "food",
      expense_date: "2026-09-03",
      payer_id: participants[1].user_id,
    };

    beforeEach(() => {
      mocks.rpc.mockImplementation((fn: string) =>
        Promise.resolve({ data: fn === "get_trip_participants" ? participants : [] }),
      );
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") return queryBuilder({ data: [], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") {
          return queryBuilder({ data: [lodgingExpense, foodExpense], error: null });
        }
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });
    });

    it("shows the flat expense list by default", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "expenses" }),
      }));

      expect(screen.getByText("Hotel")).toBeTruthy();
      expect(screen.getByText("Jantar")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Todos" }).getAttribute("aria-current")).toBe("true");
    });

    it("groups expenses by category with a per-currency subtotal", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ expenseView: "category" }),
      }));

      expect(screen.getByRole("heading", { name: "Hospedagem" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Alimentação" })).toBeTruthy();
      expect(screen.getByText("Hotel")).toBeTruthy();
      expect(screen.getByText("Jantar")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Por categoria" }).getAttribute("aria-current")).toBe("true");
    });

    it("groups expenses by payer with a per-currency subtotal", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ expenseView: "payer" }),
      }));

      expect(screen.getByText("Ana")).toBeTruthy();
      expect(screen.getByText("Bruno")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Por pagador" }).getAttribute("aria-current")).toBe("true");
    });

    it("leaves the currency totals and balances panel unaffected by the selected view", async () => {
      mocks.rpc.mockImplementation((fn: string) => {
        if (fn === "get_trip_participants") return Promise.resolve({ data: participants });
        if (fn === "get_trip_expense_balances") {
          return Promise.resolve({
            data: [
              {
                user_id: participants[0].user_id,
                display_name: "Ana",
                currency: "EUR",
                total_paid: "500.00",
                total_owed: "290.00",
                net_balance: "210.00",
              },
              {
                user_id: participants[1].user_id,
                display_name: "Bruno",
                currency: "EUR",
                total_paid: "80.00",
                total_owed: "290.00",
                net_balance: "-210.00",
              },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      });

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ expenseView: "payer" }),
      }));

      expect(screen.getByText("Total EUR")).toBeTruthy();
      expect(screen.getByText("Saldos")).toBeTruthy();
    });
  });

  describe("overview tab", () => {
    const participants = [
      { user_id: "11111111-1111-1111-1111-111111111111", display_name: "Ana", role: "organizer" },
      { user_id: "22222222-2222-2222-2222-222222222222", display_name: "Bruno", role: "traveler" },
    ];
    const taskA = { ...task, id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Passport", due_date: "2026-08-27", completed_at: null };
    const taskB = { ...task, id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", title: "Visa", due_date: "2026-08-26", completed_at: null };
    const taskC = { ...task, id: "cccccccc-cccc-cccc-cccc-cccccccccccc", title: "Insurance", due_date: null, completed_at: null };
    const taskD = { ...task, id: "dddddddd-dddd-dddd-dddd-dddddddddddd", title: "Vaccines", due_date: "2026-08-25", completed_at: null };
    const doneTask = { ...task, id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", title: "Book flights", due_date: "2026-08-20", completed_at: "2026-08-10T00:00:00Z" };
    const itineraryItem = {
      id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      trip_id: tripId,
      item_date: "2026-09-02",
      start_time: "10:00",
      title: "Museu do Louvre",
      location: null,
      notes: null,
    };
    const comment = {
      id: "comment-1",
      item_type: "itinerary",
      itinerary_item_id: itineraryItem.id,
      task_id: null,
      body: "Vamos chegar cedo para evitar fila.",
      author_id: participants[0].user_id,
      created_at: "2026-08-20T10:00:00Z",
      updated_at: "2026-08-20T10:00:00Z",
    };

    beforeEach(() => {
      mocks.rpc.mockImplementation((fn: string) =>
        Promise.resolve({ data: fn === "get_trip_participants" ? participants : [] }),
      );
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") {
          return queryBuilder({ data: [taskD, taskB, taskA, taskC, doneTask], error: null });
        }
        if (table === "itinerary_items") return queryBuilder({ data: [itineraryItem], error: null });
        if (table === "item_comments") return queryBuilder({ data: [comment], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });
    });

    it("is the default landing tab when opening a trip", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.getByText("Prontidão para a viagem")).toBeTruthy();
    });

    it("previews only the next few upcoming tasks, soonest first, excluding completed ones", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      const preview = screen.getByText("Próximos passos").closest("section")!;
      const items = within(preview).getAllByRole("listitem");
      expect(items.map((item) => item.textContent)).toEqual([
        expect.stringContaining("Vaccines"),
        expect.stringContaining("Visa"),
        expect.stringContaining("Passport"),
      ]);
      expect(within(preview).queryByText("Insurance")).toBeNull();
      expect(within(preview).queryByText("Book flights")).toBeNull();
    });

    it("lists participants with their roles", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      const list = screen.getByText("Participantes").closest("section")!;
      expect(within(list).getByText("Ana")).toBeTruthy();
      expect(within(list).getByText("Organizador")).toBeTruthy();
      expect(within(list).getByText("Bruno")).toBeTruthy();
      expect(within(list).getByText("Viajante")).toBeTruthy();
    });

    it("shows a recent comment linking back to its itinerary item", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      const link = screen.getByRole("link", { name: "Museu do Louvre" });
      expect(link.getAttribute("href")).toBe(`/trips/${tripId}?tab=itinerary#itinerary-${itineraryItem.id}`);
      expect(screen.getByText("Vamos chegar cedo para evitar fila.")).toBeTruthy();
    });
  });

  describe("destination guide", () => {
    it("shows an empty state and lets the creator add a guide", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.getByText("Nenhum guia do destino foi adicionado ainda.")).toBeTruthy();
      expect(screen.getByText("Adicionar guia do destino")).toBeTruthy();
      expect(screen.getByLabelText("Conteúdo")).toBeTruthy();
    });

    it("shows the saved guide content, source, and reviewed date", async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") {
          return queryBuilder({
            data: {
              ...trip,
              destination_guide_content: "Leve roupas leves.",
              destination_guide_source: "Guia da Aline",
              destination_guide_reviewed_at: "2026-08-01",
            },
            error: null,
          });
        }
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") return queryBuilder({ data: [], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.getByText("Leve roupas leves.", { selector: "p" })).toBeTruthy();
      expect(screen.getByText(/Fonte: Guia da Aline/, { selector: "p" })).toBeTruthy();
      expect(screen.getByText(/Revisado em/, { selector: "p" })).toBeTruthy();
      expect(screen.getByText("Editar guia do destino")).toBeTruthy();
    });

    it("does not let a plain traveler participant edit the destination guide", async () => {
      const otherUserId = "22222222-2222-2222-2222-222222222222";
      mocks.getUser.mockResolvedValue({ data: { user: { id: otherUserId } } });
      mocks.rpc.mockImplementation((fn: string) =>
        Promise.resolve({
          data: fn === "get_trip_participants"
            ? [{ user_id: otherUserId, display_name: "Bruno", role: "traveler" }]
            : [],
        }),
      );

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.queryByText("Adicionar guia do destino")).toBeNull();
      expect(screen.queryByText("Editar guia do destino")).toBeNull();
    });

    it("lets an organizer participant who is not the creator edit the destination guide", async () => {
      const organizerUserId = "33333333-3333-3333-3333-333333333333";
      mocks.getUser.mockResolvedValue({ data: { user: { id: organizerUserId } } });
      mocks.rpc.mockImplementation((fn: string) =>
        Promise.resolve({
          data: fn === "get_trip_participants"
            ? [{ user_id: organizerUserId, display_name: "Carla", role: "organizer" }]
            : [],
        }),
      );

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.getByText("Adicionar guia do destino")).toBeTruthy();
    });
  });

  describe("reservation ↔ itinerary item link", () => {
    const itineraryItem = {
      id: "11111111-1111-1111-1111-111111111111",
      trip_id: tripId,
      item_date: "2026-09-02",
      start_time: "10:00",
      title: "Museu do Louvre",
      location: null,
      notes: null,
    };
    const reservation = {
      id: "22222222-2222-2222-2222-222222222222",
      reservation_type: "transport" as const,
      title: "Taxi ao museu",
      provider: null,
      confirmation_code: null,
      start_date: "2026-09-02",
      start_time: "09:30",
      end_date: null,
      end_time: null,
      location: null,
      destination_location: null,
      notes: null,
      itinerary_item_id: itineraryItem.id,
    };

    beforeEach(() => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") return queryBuilder({ data: [itineraryItem], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_reservations") return queryBuilder({ data: [reservation], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });
    });

    it("shows the linked reservation on the itinerary item with a link to it", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "itinerary" }),
      }));

      const link = screen.getByRole("link", { name: /Reserva vinculada: Taxi ao museu/ });
      expect(link.getAttribute("href")).toBe(`/trips/${tripId}?tab=itinerary#reservation-${reservation.id}`);
    });

    it("shows the linked itinerary item on the reservation with a link to it", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "itinerary" }),
      }));

      const link = screen.getByRole("link", { name: "Museu do Louvre" });
      expect(link.getAttribute("href")).toBe(`/trips/${tripId}?tab=itinerary#itinerary-${itineraryItem.id}`);
    });
  });
});
