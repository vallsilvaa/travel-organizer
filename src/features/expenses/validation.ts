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

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  transport: "Transporte",
  lodging: "Hospedagem",
  food: "Alimentação",
  activities: "Atividades",
  shopping: "Compras",
  other: "Outro",
};
export type ExpenseFieldErrors = Partial<
  Record<"description" | "amount" | "currency" | "category" | "date" | "payer", string>
>;

export function isValidExpenseId(value: string) {
  return uuidPattern.test(value);
}

export function validateExpenseInput(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const category = String(formData.get("category") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const payerId = String(formData.get("payerId") ?? "").trim();
  const errors: ExpenseFieldErrors = {};

  if (!description || description.length > 200) {
    errors.description = "Informe uma descrição com até 200 caracteres.";
  }
  if (!amountPattern.test(rawAmount) || Number(rawAmount) <= 0) {
    errors.amount = "Informe um valor maior que zero com até duas casas decimais.";
  }
  if (!currencyPattern.test(currency)) {
    errors.currency = "Informe um código de moeda de três letras, como BRL ou USD.";
  }
  if (!expenseCategories.includes(category as ExpenseCategory)) {
    errors.category = "Escolha uma categoria válida.";
  }
  if (!datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    errors.date = "Informe uma data de despesa válida.";
  }
  if (!isValidExpenseId(payerId)) {
    errors.payer = "Escolha um pagador válido.";
  }

  return Object.keys(errors).length
    ? { success: false as const, errors }
    : {
        success: true as const,
        data: {
          description,
          amount: Number(rawAmount).toFixed(2),
          currency,
          category: category as ExpenseCategory,
          date,
          payerId,
        },
      };
}
