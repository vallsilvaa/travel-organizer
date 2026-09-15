"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { notifyTripCollaborators } from "@/features/notifications/collaboration";
import { isValidTripId } from "@/features/trips/validation";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { computeSettlements, type ParticipantBalance } from "./balances";
import { buildExpenseReminderEmail } from "./reminder-email";
import {
  isValidExpenseId,
  parseExpenseShares,
  validateExpenseInput,
  type ExpenseFieldErrors,
} from "./validation";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const currencyPattern = /^[A-Z]{3}$/;
const reminderCooldownMs = 24 * 60 * 60 * 1000;

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

  const { shares, error: sharesError } = validation.data.amount
    ? parseExpenseShares(formData, participantIdsFrom(formData), validation.data.amount)
    : { shares: [], error: undefined };
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
    p_payment_status: validation.data.paymentStatus,
    p_estimated_amount: validation.data.estimatedAmount,
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

  const { shares, error: sharesError } = validation.data.amount
    ? parseExpenseShares(formData, participantIdsFrom(formData), validation.data.amount)
    : { shares: [], error: undefined };
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
    p_payment_status: validation.data.paymentStatus,
    p_estimated_amount: validation.data.estimatedAmount,
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

export type RemindBalanceState = {
  message?: string;
  success?: boolean;
};

function formatAmountPtBr(amount: string, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

// Splitwise-style "Remind" nudge (#185): the settlement suggestion is
// recomputed server-side from the balances RPC rather than trusted from the
// form, and a row in expense_balance_reminders both records the nudge and
// rate-limits it to once per (trip, creditor, debtor, currency) every 24h.
export async function remindExpenseBalance(
  _previousState: RemindBalanceState,
  formData: FormData,
): Promise<RemindBalanceState> {
  const t = await getTranslations("trip.expenses");
  const tripId = String(formData.get("tripId") ?? "");
  const debtorUserId = String(formData.get("debtorUserId") ?? "");
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();

  if (!isValidTripId(tripId) || !uuidPattern.test(debtorUserId) || !currencyPattern.test(currency)) {
    return { message: t("remindInvalidRequest") };
  }

  const { supabase, user } = await authenticatedClient();

  if (debtorUserId === user.id) {
    return { message: t("remindInvalidRequest") };
  }

  const { data: balanceRows } = await supabase.rpc("get_trip_expense_balances", {
    requested_trip_id: tripId,
  });
  const settlements = computeSettlements(
    ((balanceRows ?? []) as {
      user_id: string;
      display_name: string;
      currency: string;
      total_paid: string;
      total_owed: string;
      net_balance: string;
    }[]).map(
      (row): ParticipantBalance => ({
        userId: row.user_id,
        displayName: row.display_name,
        currency: row.currency,
        totalPaid: row.total_paid,
        totalOwed: row.total_owed,
        netBalance: row.net_balance,
      }),
    ),
  );
  const settlement = settlements.find(
    (candidate) =>
      candidate.fromUserId === debtorUserId
      && candidate.toUserId === user.id
      && candidate.currency === currency,
  );

  if (!settlement) {
    return { message: t("remindNothingToRemind") };
  }

  const cooldownStart = new Date(Date.now() - reminderCooldownMs).toISOString();
  const { data: recentReminder } = await supabase
    .from("expense_balance_reminders")
    .select("id")
    .eq("trip_id", tripId)
    .eq("from_user_id", user.id)
    .eq("to_user_id", debtorUserId)
    .eq("currency", currency)
    .gte("sent_at", cooldownStart)
    .limit(1)
    .maybeSingle();

  if (recentReminder) {
    return { message: t("remindAlreadySent") };
  }

  const { error: insertError } = await supabase.from("expense_balance_reminders").insert({
    trip_id: tripId,
    from_user_id: user.id,
    to_user_id: debtorUserId,
    currency,
  });

  if (insertError) {
    return { message: t("remindGenericFailed") };
  }

  const [{ data: trip }, { data: senderProfile }] = await Promise.all([
    supabase.from("trips").select("destination").eq("id", tripId).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  const tripDestination = (trip as { destination: string } | null)?.destination ?? "sua viagem";
  const senderName = (senderProfile as { display_name: string } | null)?.display_name ?? "Alguém";
  const amount = formatAmountPtBr(settlement.amount, currency);
  const title = t("remindNotificationTitle", { name: senderName });
  const body = t("remindNotificationBody", { amount, destination: tripDestination });
  const linkPath = `/trips/${tripId}?tab=expenses`;

  await supabase.rpc("create_collaboration_notifications", {
    p_trip_id: tripId,
    p_recipient_ids: [debtorUserId],
    p_notification_type: "expense_reminder",
    p_title: title,
    p_body: body,
    p_link_path: linkPath,
  });

  await sendPushToUser(supabase, debtorUserId, { title, body, url: linkPath });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const { data: recipientRows } = await supabase.rpc("get_trip_participant_emails", {
      requested_trip_id: tripId,
      requested_user_ids: [debtorUserId],
    });
    const recipient = (
      (recipientRows ?? []) as { user_id: string; email: string | null; collaboration_emails_enabled: boolean }[]
    )[0];

    if (recipient?.collaboration_emails_enabled && recipient.email) {
      const message = buildExpenseReminderEmail({
        appUrl,
        senderName,
        amount,
        tripDestination,
        tripId,
      });
      const result = await sendEmail({
        to: recipient.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      if (!result.success) {
        console.error("Expense reminder email failed", { code: result.error });
      }
    }
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true, message: t("remindSent") };
}
