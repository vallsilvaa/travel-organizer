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
    is: () => typeof promise;
    limit: () => typeof promise;
    order: () => typeof promise;
    select: () => typeof promise;
    single: () => Promise<QueryResult>;
  };
  promise.select = () => promise;
  promise.eq = () => promise;
  promise.is = () => promise;
  promise.limit = () => promise;
  promise.order = () => promise;
  promise.single = () => Promise.resolve(result);
  return promise;
}

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const userId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

const trip = {
  id: tripId,
  title: "Partiu Lisboa",
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
  classification: null,
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

  it("shows the catalog task actions to an organizer participant who is not the creator (#173)", async () => {
    const organizerUserId = "33333333-3333-3333-3333-333333333333";
    mocks.getUser.mockResolvedValue({ data: { user: { id: organizerUserId } } });
    mocks.rpc.mockImplementation((fn: string) =>
      Promise.resolve({
        data: fn === "get_trip_participants"
          ? [{ user_id: organizerUserId, display_name: "Carla", role: "organizer" }]
          : [],
      }),
    );

    render(
      await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "preparation" }),
      }),
    );

    expect(screen.getByRole("button", { name: "Add Tarefa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Criar Tarefa" })).toBeTruthy();
  });

  it("shows the catalog task actions to a plain traveler participant too, not just organizers", async () => {
    const travelerUserId = "44444444-4444-4444-4444-444444444444";
    mocks.getUser.mockResolvedValue({ data: { user: { id: travelerUserId } } });
    mocks.rpc.mockImplementation((fn: string) =>
      Promise.resolve({
        data: fn === "get_trip_participants"
          ? [{ user_id: travelerUserId, display_name: "Bruno", role: "traveler" }]
          : [],
      }),
    );

    render(
      await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "preparation" }),
      }),
    );

    expect(screen.getByRole("button", { name: "Add Tarefa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Criar Tarefa" })).toBeTruthy();
  });

  it("does not show the custom-task-add section anymore (#167)", async () => {
    render(
      await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "preparation" }),
      }),
    );

    expect(screen.queryByText(/adicionar tarefa personalizada/i)).toBeNull();
  });

  it("shows a lead-time filter (#168)", async () => {
    render(
      await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "preparation" }),
      }),
    );

    expect(screen.getByLabelText("Prazo")).toBeTruthy();
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

  describe("cover image", () => {
    const tripWithCover = { ...trip, cover_image_path: `${tripId}/cover-1-beach.jpg` };
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed-cover.jpg" },
    });

    beforeEach(() => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: tripWithCover, error: null });
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") return queryBuilder({ data: [], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });
      mocks.createClient.mockResolvedValue({
        auth: { getUser: mocks.getUser },
        from: mocks.from,
        rpc: mocks.rpc,
        storage: { from: () => ({ createSignedUrl }) },
      });
    });

    it("shows the cover photo via a signed URL and lets the creator change it", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      const image = screen.getByRole("img", { name: /foto de capa da viagem para lisbon/i });
      expect(image.getAttribute("src")).toBe("https://storage.example/signed-cover.jpg");
      expect(screen.getByRole("button", { name: "Editar capa" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Remover capa" })).toBeTruthy();
    });

    it("does not offer cover image controls to a plain traveler participant", async () => {
      const travelerUserId = "44444444-4444-4444-4444-444444444444";
      mocks.getUser.mockResolvedValue({ data: { user: { id: travelerUserId } } });
      mocks.rpc.mockImplementation((fn: string) =>
        Promise.resolve({
          data: fn === "get_trip_participants"
            ? [{ user_id: travelerUserId, display_name: "Bruno", role: "traveler" }]
            : [],
        }),
      );

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({}),
      }));

      expect(screen.getByRole("img", { name: /foto de capa da viagem para lisbon/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Editar capa" })).toBeNull();
    });
  });

  describe("preparation progress by category", () => {
    const documentTaskDone = { ...task, id: "11111111-1111-1111-1111-111111111111", title: "Passport", category: "documents" as const, completed_at: "2026-08-01T00:00:00Z" };
    const documentTaskOpen = { ...task, id: "22222222-2222-2222-2222-222222222222", title: "Visa", category: "documents" as const, completed_at: null };
    const packingTaskOpen = { ...task, id: "33333333-3333-3333-3333-333333333333", title: "Sunscreen", category: "packing" as const, completed_at: null };

    beforeEach(() => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") {
          return queryBuilder({ data: [documentTaskDone, documentTaskOpen, packingTaskOpen], error: null });
        }
        if (table === "itinerary_items") return queryBuilder({ data: [], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });
    });

    it("shows a progress bar per category with only tasks in that category", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "preparation" }),
      }));

      const documentsBar = screen.getByRole("progressbar", { name: "Documentos: 50% pronto" });
      expect(documentsBar.getAttribute("aria-valuenow")).toBe("50");

      const packingBar = screen.getByRole("progressbar", { name: "Bagagem: 0% pronto" });
      expect(packingBar.getAttribute("aria-valuenow")).toBe("0");

      expect(screen.queryByRole("progressbar", { name: /Transporte:/ })).toBeNull();
    });

    it("shows a clickable category chip per category, with a count and no chip for empty categories", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "preparation" }),
      }));

      const allChip = screen.getByRole("link", { name: "Todas as categorias (3)" });
      expect(allChip.getAttribute("aria-current")).toBe("true");

      const documentsChip = screen.getByRole("link", { name: "Documentos (2)" });
      expect(documentsChip.getAttribute("href")).toContain("category=documents");
      expect(documentsChip.getAttribute("aria-current")).toBeNull();

      const packingChip = screen.getByRole("link", { name: "Bagagem (1)" });
      expect(packingChip.getAttribute("href")).toContain("category=packing");

      expect(screen.queryByRole("link", { name: /^Transporte /i })).toBeNull();
    });

    it("marks the active category chip and toggles it back to \"all\" when clicked again", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "preparation", category: "packing" }),
      }));

      const packingChip = screen.getByRole("link", { name: "Bagagem (1)" });
      expect(packingChip.getAttribute("aria-current")).toBe("true");
      expect(packingChip.getAttribute("href")).not.toContain("category=");

      const allChip = screen.getByRole("link", { name: "Todas as categorias (3)" });
      expect(allChip.getAttribute("aria-current")).toBeNull();
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

    it("shows the current user's share and percent of the group total, plus a spending-by-category chart", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: participants[0].user_id } } });
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
        searchParams: Promise.resolve({ tab: "expenses" }),
      }));

      // Hotel (500) + Jantar (80) = 580 total; Ana's total_owed is 290 (50%).
      expect(screen.getByText("Sua parte")).toBeTruthy();
      expect(screen.getByText("50%")).toBeTruthy();
      expect(screen.getByText("Gastos por categoria")).toBeTruthy();
      expect(screen.getByRole("img", { name: "Gráfico de barras de gastos por categoria em EUR" })).toBeTruthy();
    });

    it("offers a Remind button only to the participant who is owed money", async () => {
      const balances = [
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
      ];
      mocks.rpc.mockImplementation((fn: string) => {
        if (fn === "get_trip_participants") return Promise.resolve({ data: participants });
        if (fn === "get_trip_expense_balances") return Promise.resolve({ data: balances });
        return Promise.resolve({ data: [] });
      });

      mocks.getUser.mockResolvedValue({ data: { user: { id: participants[0].user_id } } });
      const { unmount } = render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "expenses" }),
      }));
      expect(screen.getByRole("button", { name: "Lembrar" })).toBeTruthy();
      unmount();

      mocks.getUser.mockResolvedValue({ data: { user: { id: participants[1].user_id } } });
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "expenses" }),
      }));
      expect(screen.queryByRole("button", { name: "Lembrar" })).toBeNull();
    });
  });

  describe("expense receipt attachments", () => {
    const expense = {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      description: "Hotel",
      amount: "500.00",
      currency: "EUR",
      category: "lodging",
      expense_date: "2026-09-02",
      payer_id: null,
    };
    const receipt = {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      item_type: "expense",
      item_id: expense.id,
      storage_path: `${tripId}/receipt-1-hotel.pdf`,
      file_name: "hotel-receipt.pdf",
      content_type: "application/pdf",
      size_bytes: 102400,
    };
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [{ path: receipt.storage_path, signedUrl: "https://storage.example/signed-receipt.pdf" }],
    });

    beforeEach(() => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") return queryBuilder({ data: [], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [expense], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        if (table === "trip_attachments") return queryBuilder({ data: [receipt], error: null });
        return queryBuilder({ data: null, error: null });
      });
      mocks.createClient.mockResolvedValue({
        auth: { getUser: mocks.getUser },
        from: mocks.from,
        rpc: mocks.rpc,
        storage: { from: () => ({ createSignedUrls }) },
      });
    });

    it("shows an attached receipt on its expense with a signed download link", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "expenses" }),
      }));

      expect(screen.getByText(/hotel-receipt\.pdf/)).toBeTruthy();
      const downloadLink = screen.getByRole("link", { name: "Baixar" });
      expect(downloadLink.getAttribute("href")).toBe("https://storage.example/signed-receipt.pdf");
    });

    it("offers an inline upload form fixed to that expense, without an association picker", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "expenses" }),
      }));

      const summary = screen.getByText("Anexar comprovante");
      summary.click();

      expect(screen.queryByLabelText(/Associar a/)).toBeNull();
      const form = summary.closest("details")?.querySelector("form");
      const itemType = form?.querySelector('input[name="itemType"]') as HTMLInputElement;
      const itemId = form?.querySelector('input[name="itemId"]') as HTMLInputElement;
      expect(itemType?.value).toBe("expense");
      expect(itemId?.value).toBe(expense.id);
    });
  });

  describe("read-only share link", () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = "https://travel.example.com";
    });

    afterEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    });

    it("offers to generate a link when the trip has none yet", async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") return queryBuilder({ data: [], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        if (table === "trip_share_links") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "organizer" }),
      }));

      expect(screen.getByRole("button", { name: "Gerar link" })).toBeTruthy();
    });

    it("shows the full share URL, copy, and revoke controls when a link is active", async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") return queryBuilder({ data: [], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        if (table === "trip_share_links") {
          return queryBuilder({ data: [{ id: "share-link-1", token: "abc123token" }], error: null });
        }
        return queryBuilder({ data: null, error: null });
      });

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "organizer" }),
      }));

      expect(screen.getByText("https://travel.example.com/share/abc123token")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Revogar" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Gerar link" })).toBeNull();
    });
  });

  describe("itinerary day heading", () => {
    it("shows the day of week alongside the day number and date", async () => {
      // The day-by-day view only renders once the trip has at least one
      // itinerary item - an empty trip shows an empty state instead.
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") {
          return queryBuilder({
            data: [{
              id: "11111111-1111-1111-1111-111111111111",
              item_date: "2026-09-01",
              start_time: null,
              title: "Chegada",
              location: null,
              notes: null,
              period: null,
              city: null,
            }],
            error: null,
          });
        }
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "itinerary" }),
      }));

      // trip.start_date is 2026-09-01, a Tuesday.
      expect(screen.getByText("Dia 1 · terça-feira, 1 de setembro de 2026")).toBeTruthy();
    });
  });

  describe("destinations and invite lock", () => {
    it("renders each structured destination as a badge in the trip header", async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_destinations") {
          return queryBuilder({
            data: [
              { id: "d1", label: "Lisboa, Portugal", city: "Lisboa", country: "Portugal", continent: "europe", granularity: "city", position: 0 },
              { id: "d2", label: "Porto, Portugal", city: "Porto", country: "Portugal", continent: "europe", granularity: "city", position: 1 },
            ],
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

      expect(screen.getByText("Lisboa, Portugal")).toBeTruthy();
      expect(screen.getByText("Porto, Portugal")).toBeTruthy();
    });

    it("shows an invite-locked notice instead of the invite form once the trip is no longer upcoming", async () => {
      // The shared `trip` fixture (2026-09-01 to 2026-09-10) is already in
      // the past relative to the real clock, so its status is "completed".
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "organizer" }),
      }));

      expect(screen.queryByLabelText("E-mail do convidado")).toBeNull();
      expect(
        screen.getByText("Novos participantes só podem ser convidados enquanto a viagem estiver futura."),
      ).toBeTruthy();
    });

    it("shows the invite form while the trip is still upcoming", async () => {
      const upcomingTrip = { ...trip, start_date: "2099-01-10", end_date: "2099-01-20" };
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: upcomingTrip, error: null });
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
        searchParams: Promise.resolve({ tab: "organizer" }),
      }));

      expect(screen.getByLabelText("E-mail do convidado")).toBeTruthy();
      expect(
        screen.queryByText("Novos participantes só podem ser convidados enquanto a viagem estiver futura."),
      ).toBeNull();
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
      expect(link.getAttribute("href")).toBe(`/trips/${tripId}?tab=reservations#reservation-${reservation.id}`);
    });

    it("shows the linked itinerary item on the reservation with a link to it", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "reservations" }),
      }));

      const link = screen.getByRole("link", { name: "Museu do Louvre" });
      expect(link.getAttribute("href")).toBe(`/trips/${tripId}?tab=itinerary#itinerary-${itineraryItem.id}`);
    });

    it("offers a calendar download and, when a location is set, a map link for the reservation", async () => {
      const reservationWithLocation = { ...reservation, location: "Museu do Louvre" };
      mocks.from.mockImplementation((table: string) => {
        if (table === "trips") return queryBuilder({ data: trip, error: null });
        if (table === "trip_tasks") return queryBuilder({ data: [], error: null });
        if (table === "itinerary_items") return queryBuilder({ data: [itineraryItem], error: null });
        if (table === "item_comments") return queryBuilder({ data: [], error: null });
        if (table === "trip_reservations") return queryBuilder({ data: [reservationWithLocation], error: null });
        if (table === "trip_expenses") return queryBuilder({ data: [], error: null });
        if (table === "trip_expense_shares") return queryBuilder({ data: [], error: null });
        if (table === "trip_invitations") return queryBuilder({ data: [], error: null });
        return queryBuilder({ data: null, error: null });
      });

      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "reservations" }),
      }));

      const calendarLink = screen.getByRole("link", { name: "Adicionar ao calendário" });
      expect(calendarLink.getAttribute("href")).toBe(`/api/trips/${tripId}/reservations/${reservation.id}/ics`);

      const mapLink = screen.getByRole("link", { name: "Ver no mapa" });
      expect(mapLink.getAttribute("href")).toContain(encodeURIComponent("Museu do Louvre"));
      expect(mapLink.getAttribute("target")).toBe("_blank");
    });

    it("hides the map link when the reservation has no location", async () => {
      render(await TripPage({
        params: Promise.resolve({ tripId }),
        searchParams: Promise.resolve({ tab: "reservations" }),
      }));

      expect(screen.getByRole("link", { name: "Adicionar ao calendário" })).toBeTruthy();
      expect(screen.queryByRole("link", { name: "Ver no mapa" })).toBeNull();
    });
  });
});
