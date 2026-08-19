import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createExpense, deleteExpense, updateExpense } from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const expenseId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const payerId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";

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
  return formData;
}

describe("expense actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = { delete: mocks.delete, eq: mocks.eq, update: mocks.update };
    mocks.delete.mockReturnValue(builder);
    mocks.eq.mockReturnValue(builder);
    mocks.update.mockReturnValue(builder);
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ ...builder, insert: mocks.insert });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("creates an expense with its currency and payer", async () => {
    const result = await createExpense({}, validForm());

    expect(mocks.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      description: "Dinner reservation",
      amount: "125.50",
      currency: "BRL",
      category: "food",
      expense_date: "2026-10-12",
      payer_id: payerId,
      created_by: "user-123",
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("updates only the selected trip expense", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    const result = await updateExpense({}, validForm());

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "125.50", currency: "BRL", payer_id: payerId }),
    );
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", expenseId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(result.success).toBe(true);
  });

  it("deletes only the selected trip expense", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

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
