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
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
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

import { createExpense, deleteExpense, updateExpense } from "./actions";

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
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
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
