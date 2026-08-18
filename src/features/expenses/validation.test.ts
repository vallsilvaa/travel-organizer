import { describe, expect, it } from "vitest";

import { validateExpenseInput } from "./validation";

const payerId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

function validForm() {
  const formData = new FormData();
  formData.set("description", "Dinner reservation");
  formData.set("amount", "125.50");
  formData.set("currency", "brl");
  formData.set("category", "food");
  formData.set("date", "2026-10-12");
  formData.set("payerId", payerId);
  return formData;
}

describe("validateExpenseInput", () => {
  it("normalizes a valid expense", () => {
    expect(validateExpenseInput(validForm())).toEqual({
      success: true,
      data: {
        description: "Dinner reservation",
        amount: "125.50",
        currency: "BRL",
        category: "food",
        date: "2026-10-12",
        payerId,
      },
    });
  });

  it.each(["0", "-5", "12.345", "not-a-number"])(
    "rejects the invalid amount %s",
    (amount) => {
      const formData = validForm();
      formData.set("amount", amount);

      const result = validateExpenseInput(formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.amount).toBe(
          "Enter an amount greater than zero with up to two decimals.",
        );
      }
    },
  );

  it("rejects an invalid currency, category, date, and payer", () => {
    const formData = validForm();
    formData.set("currency", "REAL");
    formData.set("category", "unknown");
    formData.set("date", "tomorrow");
    formData.set("payerId", "someone");

    const result = validateExpenseInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.errors)).toEqual(
        expect.arrayContaining(["currency", "category", "date", "payer"]),
      );
    }
  });
});
