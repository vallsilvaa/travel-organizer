"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  isValidExpenseId,
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

export async function createExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const validation = validateExpenseInput(formData);

  if (!isValidExpenseId(tripId)) {
    return { message: "The trip could not be identified." };
  }
  if (!validation.success) {
    return { errors: validation.errors };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("trip_expenses").insert({
    trip_id: tripId,
    description: validation.data.description,
    amount: validation.data.amount,
    currency: validation.data.currency,
    category: validation.data.category,
    expense_date: validation.data.date,
    payer_id: validation.data.payerId,
    created_by: user.id,
  });

  if (error) {
    return { message: "We could not add this expense. Check the payer and your trip access." };
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
    return { message: "The expense could not be identified." };
  }
  if (!validation.success) {
    return { errors: validation.errors };
  }

  const { supabase } = await authenticatedClient();
  const { error } = await supabase
    .from("trip_expenses")
    .update({
      description: validation.data.description,
      amount: validation.data.amount,
      currency: validation.data.currency,
      category: validation.data.category,
      expense_date: validation.data.date,
      payer_id: validation.data.payerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", expenseId)
    .eq("trip_id", tripId);

  if (error) {
    return { message: "We could not update this expense. Try again." };
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
