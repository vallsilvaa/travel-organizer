import { describe, expect, it } from "vitest";

import {
  computeEqualShares,
  parseExpenseShares,
  validateExpenseInput,
} from "./validation";

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
          "Informe um valor maior que zero com até duas casas decimais.",
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

describe("computeEqualShares", () => {
  it("splits a round amount evenly", () => {
    expect(computeEqualShares("30.00", ["a", "b", "c"])).toEqual({
      a: "10.00",
      b: "10.00",
      c: "10.00",
    });
  });

  it("hands leftover cents to the first participants so the split sums exactly", () => {
    const shares = computeEqualShares("10.00", ["a", "b", "c"]);

    expect(shares).toEqual({ a: "3.34", b: "3.33", c: "3.33" });
    const total = Object.values(shares).reduce((sum, value) => sum + Number(value), 0);
    expect(total.toFixed(2)).toBe("10.00");
  });

  it("returns an empty split with no participants", () => {
    expect(computeEqualShares("10.00", [])).toEqual({});
  });
});

describe("parseExpenseShares", () => {
  const alice = "11111111-1111-1111-1111-111111111111";
  const bob = "22222222-2222-2222-2222-222222222222";

  it("returns no shares when none of the fields are filled in", () => {
    const formData = new FormData();
    expect(parseExpenseShares(formData, [alice, bob], "10.00")).toEqual({ shares: [] });
  });

  it("accepts shares that sum exactly to the total", () => {
    const formData = new FormData();
    formData.set(`share_${alice}`, "6.00");
    formData.set(`share_${bob}`, "4.00");

    expect(parseExpenseShares(formData, [alice, bob], "10.00")).toEqual({
      shares: [
        { userId: alice, shareAmount: "6.00" },
        { userId: bob, shareAmount: "4.00" },
      ],
    });
  });

  it("rejects shares that do not sum to the total", () => {
    const formData = new FormData();
    formData.set(`share_${alice}`, "6.00");
    formData.set(`share_${bob}`, "3.00");

    const result = parseExpenseShares(formData, [alice, bob], "10.00");

    expect(result.shares).toEqual([]);
    expect(result.error).toBe("A soma da divisão deve ser igual ao valor total da despesa.");
  });

  it("rejects a malformed share amount", () => {
    const formData = new FormData();
    formData.set(`share_${alice}`, "not-a-number");

    const result = parseExpenseShares(formData, [alice, bob], "10.00");

    expect(result.error).toBe(
      "Os valores da divisão devem ser números válidos com até duas casas decimais.",
    );
  });

  it("drops zero-amount shares without requiring them to add up", () => {
    const formData = new FormData();
    formData.set(`share_${alice}`, "10.00");
    formData.set(`share_${bob}`, "0");

    expect(parseExpenseShares(formData, [alice, bob], "10.00")).toEqual({
      shares: [{ userId: alice, shareAmount: "10.00" }],
    });
  });
});
