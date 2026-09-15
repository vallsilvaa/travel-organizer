import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  sendEmail: vi.fn(),
  sendPushToUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/push", () => ({ sendPushToUser: mocks.sendPushToUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    fn();
  },
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import { createExpense, deleteExpense, remindExpenseBalance, updateExpense } from "./actions";

type QueryResult = { data: unknown; error?: unknown };

function queryBuilder(result: QueryResult) {
  const promise = Promise.resolve(result) as Promise<QueryResult> & {
    eq: () => typeof promise;
    gte: () => typeof promise;
    limit: () => typeof promise;
    maybeSingle: () => Promise<QueryResult>;
    select: () => typeof promise;
    insert: () => Promise<QueryResult>;
  };
  promise.select = () => promise;
  promise.eq = () => promise;
  promise.gte = () => promise;
  promise.limit = () => promise;
  promise.maybeSingle = () => Promise.resolve(result);
  promise.insert = () => Promise.resolve(result);
  return promise;
}

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const expenseId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const payerId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";
const otherParticipantId = "11111111-1111-1111-1111-111111111111";

function validForm() {
  const formData = new FormData();
  formData.set("tripId", tripId);
  formData.set("expenseId", expenseId);
  formData.set("description", "Dinner reservation");
  formData.set("amount", "125.50");
  formData.set("currency", "BRL");
  formData.set("category", "food");
  formData.set("date", "2026-10-12");
  formData.set("payerId", payerId);
  formData.set("participantIds", `${payerId},${otherParticipantId}`);
  return formData;
}

describe("expense actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = { delete: mocks.delete, eq: mocks.eq };
    mocks.delete.mockReturnValue(builder);
    mocks.eq.mockReturnValue(builder);
    mocks.rpc.mockResolvedValue({ data: expenseId, error: null });
    mocks.from.mockReturnValue(builder);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
      rpc: mocks.rpc,
    });
  });

  it("creates an expense with its currency and payer, without a split by default", async () => {
    const result = await createExpense({}, validForm());

    expect(mocks.rpc).toHaveBeenCalledWith("create_expense_with_shares", {
      p_trip_id: tripId,
      p_description: "Dinner reservation",
      p_amount: "125.50",
      p_currency: "BRL",
      p_category: "food",
      p_expense_date: "2026-10-12",
      p_payer_id: payerId,
      p_shares: [],
      p_payment_status: "paid",
      p_estimated_amount: null,
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("creates a to_pay expense with only an estimate and no shares (#171)", async () => {
    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("description", "Planned museum tickets");
    formData.set("paymentStatus", "to_pay");
    formData.set("estimatedAmount", "40");
    formData.set("currency", "BRL");
    formData.set("category", "activities");
    formData.set("date", "2026-10-12");
    formData.set("participantIds", `${payerId},${otherParticipantId}`);

    const result = await createExpense({}, formData);

    expect(mocks.rpc).toHaveBeenCalledWith("create_expense_with_shares", {
      p_trip_id: tripId,
      p_description: "Planned museum tickets",
      p_amount: null,
      p_currency: "BRL",
      p_category: "activities",
      p_expense_date: "2026-10-12",
      p_payer_id: null,
      p_shares: [],
      p_payment_status: "to_pay",
      p_estimated_amount: "40.00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a to_pay expense with neither an amount nor an estimate", async () => {
    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("description", "Nothing yet");
    formData.set("paymentStatus", "to_pay");
    formData.set("currency", "BRL");
    formData.set("category", "activities");
    formData.set("date", "2026-10-12");

    const result = await createExpense({}, formData);

    expect(result.errors?.amount).toBeTruthy();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("creates an expense with a matching split", async () => {
    const formData = validForm();
    formData.set(`share_${payerId}`, "75.50");
    formData.set(`share_${otherParticipantId}`, "50.00");

    const result = await createExpense({}, formData);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_expense_with_shares",
      expect.objectContaining({
        p_shares: [
          { user_id: payerId, share_amount: "75.50" },
          { user_id: otherParticipantId, share_amount: "50.00" },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a split that does not sum to the total before contacting Supabase", async () => {
    const formData = validForm();
    formData.set(`share_${payerId}`, "10.00");
    formData.set(`share_${otherParticipantId}`, "10.00");

    const result = await createExpense({}, formData);

    expect(result.errors?.split).toBe(
      "A soma da divisão deve ser igual ao valor total da despesa.",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("surfaces a friendly message when the database rejects the split", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "shares_do_not_match_total" } });

    const result = await createExpense({}, validForm());

    expect(result.message).toBe(
      "A soma da divisão deve ser igual ao valor total da despesa.",
    );
  });

  it("updates only the selected trip expense", async () => {
    const result = await updateExpense({}, validForm());

    expect(mocks.rpc).toHaveBeenCalledWith("update_expense_with_shares", {
      p_expense_id: expenseId,
      p_trip_id: tripId,
      p_description: "Dinner reservation",
      p_amount: "125.50",
      p_currency: "BRL",
      p_category: "food",
      p_expense_date: "2026-10-12",
      p_payer_id: payerId,
      p_shares: [],
      p_payment_status: "paid",
      p_estimated_amount: null,
    });
    expect(result.success).toBe(true);
  });

  it("deletes only the selected trip expense", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockReturnValueOnce({
      select: () => ({ maybeSingle: async () => ({ data: { description: "Dinner reservation" } }) }),
    });

    await deleteExpense(validForm());

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", expenseId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
  });

  it("rejects a negative amount before contacting Supabase", async () => {
    const formData = validForm();
    formData.set("amount", "-10");

    const result = await createExpense({}, formData);

    expect(result.errors?.amount).toBe(
      "Informe um valor maior que zero com até duas casas decimais.",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("remindExpenseBalance", () => {
  const creditorId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";
  const debtorId = "11111111-1111-4111-8111-111111111111";
  const balanceRows = [
    { user_id: creditorId, display_name: "Ana", currency: "BRL", total_paid: "150.00", total_owed: "100.00", net_balance: "50.00" },
    { user_id: debtorId, display_name: "Bruno", currency: "BRL", total_paid: "0.00", total_owed: "50.00", net_balance: "-50.00" },
  ];

  function singleRowBuilder(data: unknown) {
    const chain = { eq: () => chain, maybeSingle: () => Promise.resolve({ data, error: null }) };
    return { select: () => chain };
  }

  function remindForm(overrides: Partial<Record<"tripId" | "debtorUserId" | "currency", string>> = {}) {
    const formData = new FormData();
    formData.set("tripId", overrides.tripId ?? tripId);
    formData.set("debtorUserId", overrides.debtorUserId ?? debtorId);
    formData.set("currency", overrides.currency ?? "BRL");
    return formData;
  }

  function setupFrom({ recentReminder = null as unknown, insertError = null as unknown } = {}) {
    const reminderSelectChain = {
      eq: () => reminderSelectChain,
      gte: () => reminderSelectChain,
      limit: () => reminderSelectChain,
      maybeSingle: () => Promise.resolve({ data: recentReminder, error: null }),
    };
    mocks.from.mockImplementation((table: string) => {
      if (table === "expense_balance_reminders") {
        return { select: () => reminderSelectChain, insert: () => Promise.resolve({ error: insertError }) };
      }
      if (table === "trips") return singleRowBuilder({ destination: "Paris" });
      if (table === "profiles") return singleRowBuilder({ display_name: "Ana" });
      return queryBuilder({ data: null, error: null });
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: creditorId } } });
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === "get_trip_expense_balances") return Promise.resolve({ data: balanceRows });
      if (fn === "get_trip_participant_emails") {
        return Promise.resolve({
          data: [{ user_id: debtorId, email: "bruno@example.com", collaboration_emails_enabled: true }],
        });
      }
      return Promise.resolve({ data: null });
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
      rpc: mocks.rpc,
    });
    process.env.NEXT_PUBLIC_APP_URL = "https://travel.example.com";
    mocks.sendEmail.mockResolvedValue({ success: true, messageId: "msg-1" });
  });

  it("records the reminder and notifies the debtor by in-app, push, and email", async () => {
    setupFrom();

    const result = await remindExpenseBalance({}, remindForm());

    expect(result.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_collaboration_notifications",
      expect.objectContaining({ p_recipient_ids: [debtorId], p_notification_type: "expense_reminder" }),
    );
    expect(mocks.sendPushToUser).toHaveBeenCalledWith(expect.anything(), debtorId, expect.objectContaining({ title: expect.any(String) }));
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "bruno@example.com" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("does not email a debtor who opted out of collaboration emails", async () => {
    setupFrom();
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === "get_trip_expense_balances") return Promise.resolve({ data: balanceRows });
      if (fn === "get_trip_participant_emails") {
        return Promise.resolve({
          data: [{ user_id: debtorId, email: "bruno@example.com", collaboration_emails_enabled: false }],
        });
      }
      return Promise.resolve({ data: null });
    });

    const result = await remindExpenseBalance({}, remindForm());

    expect(result.success).toBe(true);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses to send when there is no matching settlement (already settled)", async () => {
    setupFrom();
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === "get_trip_expense_balances") {
        return Promise.resolve({
          data: balanceRows.map((row) => ({ ...row, net_balance: "0.00" })),
        });
      }
      return Promise.resolve({ data: null });
    });

    const result = await remindExpenseBalance({}, remindForm());

    expect(result.success).toBeFalsy();
    expect(mocks.sendPushToUser).not.toHaveBeenCalled();
  });

  it("rate-limits to one reminder per debtor/currency every 24h", async () => {
    setupFrom({ recentReminder: { id: "existing-reminder" } });

    const result = await remindExpenseBalance({}, remindForm());

    expect(result.success).toBeFalsy();
    expect(mocks.sendPushToUser).not.toHaveBeenCalled();
  });

  it("rejects reminding yourself", async () => {
    setupFrom();

    const result = await remindExpenseBalance({}, remindForm({ debtorUserId: creditorId }));

    expect(result.success).toBeFalsy();
    expect(mocks.sendPushToUser).not.toHaveBeenCalled();
  });

  it("rejects a malformed request before contacting Supabase", async () => {
    const result = await remindExpenseBalance({}, remindForm({ debtorUserId: "not-a-uuid" }));

    expect(result.success).toBeFalsy();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
