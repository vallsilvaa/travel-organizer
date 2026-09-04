"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { notifyTripCollaborators } from "@/features/notifications/collaboration";
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

function expenseErrorMessage(
  t: Awaited<ReturnType<typeof getTranslations<"expenseForm">>>,
  error: { message?: string },
) {
  switch (error.message) {
    case "shares_do_not_match_total":
      return t("actionErrors.sharesTotalMismatch");
    case "invalid_participant":
    case "invalid_payer":
      return t("actionErrors.invalidParticipant");
    case "not_authorized":
      return t("actionErrors.notAuthorized");
    case "trip_archived":
      return t("actionErrors.tripArchived");
    default:
      return t("actionErrors.genericFailed");
  }
}

export async function createExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const t = await getTranslations("expenseForm");
  const tripId = String(formData.get("tripId") ?? "");
  const validation = validateExpenseInput(formData);

  if (!isValidExpenseId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { shares, error: sharesError } = parseExpenseShares(
    formData,
    participantIdsFrom(formData),
    validation.data.amount,
  );
  if (sharesError) {
    return { errors: translateFieldErrors(t, { split: sharesError }) };
  }

  const { supabase, user } = await authenticatedClient();
  const { data: expenseId, error } = await supabase.rpc("create_expense_with_shares", {
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
    return { message: expenseErrorMessage(t, error) };
  }

  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "trip_expense",
      entityId: expenseId as string,
      action: "created",
      itemLabel: validation.data.description,
      tab: "expenses",
    }),
  );
  return { success: true };
}

export async function updateExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const t = await getTranslations("expenseForm");
  const tripId = String(formData.get("tripId") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  const validation = validateExpenseInput(formData);

  if (!isValidExpenseId(tripId) || !isValidExpenseId(expenseId)) {
    return { message: t("actionErrors.identifyExpense") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { shares, error: sharesError } = parseExpenseShares(
    formData,
    participantIdsFrom(formData),
    validation.data.amount,
  );
  if (sharesError) {
    return { errors: translateFieldErrors(t, { split: sharesError }) };
  }

  const { supabase, user } = await authenticatedClient();
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
    return { message: expenseErrorMessage(t, error) };
  }

  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "trip_expense",
      entityId: expenseId,
      action: "updated",
      itemLabel: validation.data.description,
      tab: "expenses",
    }),
  );
  return { success: true };
}

export async function deleteExpense(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");

  if (!isValidExpenseId(tripId) || !isValidExpenseId(expenseId)) {
    return;
  }

  const { supabase, user } = await authenticatedClient();
  const { data: deleted } = await supabase
    .from("trip_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("trip_id", tripId)
    .select("description")
    .maybeSingle();
  revalidatePath(`/trips/${tripId}`);

  if (deleted) {
    after(() =>
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: user.id,
        entityType: "trip_expense",
        entityId: expenseId,
        action: "deleted",
        itemLabel: deleted.description,
        tab: "expenses",
      }),
    );
  }
}
