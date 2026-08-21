"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  isValidExpenseId,
  parseExpenseShares,
  validateExpenseInput,
  type ExpenseFieldErrors,
} from "./validation";

export type ExpenseActionState = {
  errors?: ExpenseFieldErrors;
  message?: string;
  success?: boolean;
};

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  return { supabase, user };
}

function participantIdsFrom(formData: FormData) {
  return String(formData.get("participantIds") ?? "")
    .split(",")
    .filter(Boolean);
}

function expenseErrorMessage(error: { message?: string }) {
  switch (error.message) {
    case "shares_do_not_match_total":
      return "A soma da divisão deve ser igual ao valor total da despesa.";
    case "invalid_participant":
    case "invalid_payer":
      return "Só é possível dividir a despesa entre participantes da viagem.";
    case "not_authorized":
      return "Você não tem acesso a esta viagem.";
    case "trip_archived":
      return "Esta viagem está arquivada. Reative-a para alterar despesas.";
    default:
      return "Não foi possível salvar esta despesa. Verifique o pagador, a divisão e seu acesso à viagem.";
  }
}

export async function createExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const validation = validateExpenseInput(formData);

  if (!isValidExpenseId(tripId)) {
    return { message: "Não foi possível identificar a viagem." };
  }
  if (!validation.success) {
    return { errors: validation.errors };
  }

  const { shares, error: sharesError } = parseExpenseShares(
    formData,
    participantIdsFrom(formData),
    validation.data.amount,
  );
  if (sharesError) {
    return { errors: { split: sharesError } };
  }

  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("create_expense_with_shares", {
    p_trip_id: tripId,
    p_description: validation.data.description,
    p_amount: validation.data.amount,
    p_currency: validation.data.currency,
    p_category: validation.data.category,
    p_expense_date: validation.data.date,
    p_payer_id: validation.data.payerId,
    p_shares: shares.map((share) => ({
      user_id: share.userId,
      share_amount: share.shareAmount,
    })),
  });

  if (error) {
    return { message: expenseErrorMessage(error) };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function updateExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  const validation = validateExpenseInput(formData);

  if (!isValidExpenseId(tripId) || !isValidExpenseId(expenseId)) {
    return { message: "Não foi possível identificar a despesa." };
  }
  if (!validation.success) {
    return { errors: validation.errors };
  }

  const { shares, error: sharesError } = parseExpenseShares(
    formData,
    participantIdsFrom(formData),
    validation.data.amount,
  );
  if (sharesError) {
    return { errors: { split: sharesError } };
  }

  const { supabase } = await authenticatedClient();
  const { error } = await supabase.rpc("update_expense_with_shares", {
    p_expense_id: expenseId,
    p_trip_id: tripId,
    p_description: validation.data.description,
    p_amount: validation.data.amount,
    p_currency: validation.data.currency,
    p_category: validation.data.category,
    p_expense_date: validation.data.date,
    p_payer_id: validation.data.payerId,
    p_shares: shares.map((share) => ({
      user_id: share.userId,
      share_amount: share.shareAmount,
    })),
  });

  if (error) {
    return { message: expenseErrorMessage(error) };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteExpense(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");

  if (!isValidExpenseId(tripId) || !isValidExpenseId(expenseId)) {
    return;
  }

  const { supabase } = await authenticatedClient();
  await supabase
    .from("trip_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
}
