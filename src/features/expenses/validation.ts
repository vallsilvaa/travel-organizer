const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const amountPattern = /^\d{1,12}(?:\.\d{1,2})?$/;
const currencyPattern = /^[A-Z]{3}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const expenseCategories = [
  "transport",
  "lodging",
  "food",
  "activities",
  "shopping",
  "other",
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];

// Built from a translator scoped to "categories.expense" at each call site
// rather than a hardcoded record - this module has no render-time locale.
export function getExpenseCategoryLabels(t: (category: ExpenseCategory) => string): Record<ExpenseCategory, string> {
  return Object.fromEntries(expenseCategories.map((category) => [category, t(category)])) as Record<ExpenseCategory, string>;
}
export const paymentStatuses = ["paid", "to_pay"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (paymentStatuses as readonly string[]).includes(value);
}

export type ExpenseFieldErrors = Partial<
  Record<
    "description" | "amount" | "currency" | "category" | "date" | "payer" | "split" | "estimatedAmount",
    string
  >
>;

export type ExpenseShare = { userId: string; shareAmount: string };

function toCents(amount: string) {
  return Math.round(Number(amount) * 100);
}

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Splits a total into whole cents across participants, handing any
 * leftover pennies to the first few so the shares always sum exactly. */
export function computeEqualShares(
  totalAmount: string,
  participantIds: string[],
): Record<string, string> {
  const totalCents = toCents(totalAmount);
  if (!Number.isFinite(totalCents) || participantIds.length === 0) {
    return {};
  }

  const base = Math.floor(totalCents / participantIds.length);
  const remainder = totalCents - base * participantIds.length;

  return Object.fromEntries(
    participantIds.map((id, index) => [
      id,
      fromCents(base + (index < remainder ? 1 : 0)),
    ]),
  );
}

export function parseExpenseShares(
  formData: FormData,
  participantIds: string[],
  totalAmount: string,
): { shares: ExpenseShare[]; error?: string } {
  const shares: ExpenseShare[] = [];
  let sawAnyField = false;

  for (const participantId of participantIds) {
    const raw = formData.get(`share_${participantId}`);
    if (raw === null) {
      continue;
    }

    const value = String(raw).trim();
    if (!value) {
      continue;
    }

    sawAnyField = true;
    if (!amountPattern.test(value)) {
      return {
        shares: [],
        error: "splitAmountInvalid",
      };
    }

    const cents = toCents(value);
    if (cents > 0) {
      shares.push({ userId: participantId, shareAmount: fromCents(cents) });
    }
  }

  if (!sawAnyField) {
    return { shares: [] };
  }

  const sharesCents = shares.reduce((sum, share) => sum + toCents(share.shareAmount), 0);
  if (sharesCents !== toCents(totalAmount)) {
    return {
      shares: [],
      error: "splitMismatch",
    };
  }

  return { shares };
}

export function isValidExpenseId(value: string) {
  return uuidPattern.test(value);
}

export function validateExpenseInput(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const rawPaymentStatus = String(formData.get("paymentStatus") ?? "paid");
  const paymentStatus: PaymentStatus = isPaymentStatus(rawPaymentStatus) ? rawPaymentStatus : "paid";
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const rawEstimatedAmount = String(formData.get("estimatedAmount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const category = String(formData.get("category") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const rawPayerId = String(formData.get("payerId") ?? "").trim();
  const errors: ExpenseFieldErrors = {};

  if (!description || description.length > 200) {
    errors.description = "descriptionRequired";
  }

  // A "paid" expense needs the real numbers now; a "to_pay" one may still
  // only have an estimate (#171) - amount and payer become required
  // exactly when it's marked paid, not before.
  let amount: string | null = null;
  if (rawAmount) {
    if (!amountPattern.test(rawAmount) || Number(rawAmount) <= 0) {
      errors.amount = "amountInvalid";
    } else {
      amount = Number(rawAmount).toFixed(2);
    }
  } else if (paymentStatus === "paid") {
    errors.amount = "amountRequiredWhenPaid";
  }

  let estimatedAmount: string | null = null;
  if (rawEstimatedAmount) {
    if (!amountPattern.test(rawEstimatedAmount) || Number(rawEstimatedAmount) <= 0) {
      errors.estimatedAmount = "estimatedAmountInvalid";
    } else {
      estimatedAmount = Number(rawEstimatedAmount).toFixed(2);
    }
  }

  if (!amount && !estimatedAmount) {
    errors.amount = errors.amount ?? "amountOrEstimateRequired";
  }

  if (!currencyPattern.test(currency)) {
    errors.currency = "currencyInvalid";
  }
  if (!expenseCategories.includes(category as ExpenseCategory)) {
    errors.category = "categoryInvalid";
  }
  if (!datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    errors.date = "dateInvalid";
  }

  let payerId: string | null = null;
  if (rawPayerId) {
    if (!isValidExpenseId(rawPayerId)) {
      errors.payer = "payerInvalid";
    } else {
      payerId = rawPayerId;
    }
  } else if (paymentStatus === "paid") {
    errors.payer = "payerRequiredWhenPaid";
  }

  return Object.keys(errors).length
    ? { success: false as const, errors }
    : {
        success: true as const,
        data: {
          description,
          paymentStatus,
          amount,
          estimatedAmount,
          currency,
          category: category as ExpenseCategory,
          date,
          payerId,
        },
      };
}
