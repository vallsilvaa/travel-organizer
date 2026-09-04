"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { createClient } from "@/lib/supabase/server";
import {
  isValidTaskId,
  validateTaskInput,
  type TaskFieldErrors,
} from "./validation";
import { buildEnglandPreparationTasks, dateBeforeTrip } from "./templates";
import {
  isValidPrepItemId,
  validatePrepItemInput,
  type PrepItemFieldErrors,
} from "./prep-item-validation";

export type TaskActionState = {
  errors?: TaskFieldErrors;
  message?: string;
  success?: boolean;
};

export type PrepItemActionState = {
  errors?: PrepItemFieldErrors;
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

export async function createTask(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const t = await getTranslations("taskForm");
  const tripId = String(formData.get("tripId") ?? "");
  const validation = validateTaskInput(formData);

  if (!isValidTaskId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("trip_tasks").insert({
    trip_id: tripId,
    title: validation.data.title,
    owner_id: validation.data.ownerId,
    due_date: validation.data.dueDate,
    due_offset_days: null,
    category: validation.data.category,
    is_critical: validation.data.isCritical,
    reference_label: validation.data.referenceLabel,
    reference_url: validation.data.referenceUrl,
    created_by: user.id,
  });

  if (error) {
    return { message: t("actionErrors.addFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function updateTask(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const t = await getTranslations("taskForm");
  const tripId = String(formData.get("tripId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const validation = validateTaskInput(formData);

  if (!isValidTaskId(tripId) || !isValidTaskId(taskId)) {
    return { message: t("actionErrors.identifyTask") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase } = await authenticatedClient();
  const { error } = await supabase
    .from("trip_tasks")
    .update({
      title: validation.data.title,
      owner_id: validation.data.ownerId,
      due_date: validation.data.dueDate,
      due_offset_days: null,
      category: validation.data.category,
      is_critical: validation.data.isCritical,
      reference_label: validation.data.referenceLabel,
      reference_url: validation.data.referenceUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("trip_id", tripId);

  if (error) {
    return { message: t("actionErrors.updateFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteTask(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");

  if (!isValidTaskId(tripId) || !isValidTaskId(taskId)) {
    return;
  }

  const { supabase } = await authenticatedClient();
  await supabase.from("trip_tasks").delete().eq("id", taskId).eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
}

export async function addEnglandPreparationChecklist(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");

  if (!isValidTaskId(tripId)) {
    return;
  }

  const { supabase, user } = await authenticatedClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, start_date")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return;
  }

  await supabase
    .from("trip_tasks")
    .upsert(buildEnglandPreparationTasks(trip.id, trip.start_date, user.id), {
      ignoreDuplicates: true,
      onConflict: "trip_id,template_key",
    });
  revalidatePath(`/trips/${tripId}`);
}

export async function setTaskCompletion(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const shouldComplete = formData.get("completed") === "true";

  if (!isValidTaskId(tripId) || !isValidTaskId(taskId)) {
    return;
  }

  const { supabase } = await authenticatedClient();
  // Completion (and any linked-expense creation/cleanup) is atomic and
  // authorization-checked inside this RPC - see
  // 20260904020000_complete_prep_item_and_expense_link.sql. Works for plain
  // ad-hoc tasks too: expense linking is a no-op when there's no
  // estimated/paid amount on the row.
  await supabase.rpc("complete_prep_item", {
    p_task_id: taskId,
    p_should_complete: shouldComplete,
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function updatePrepTripItem(
  _previousState: PrepItemActionState,
  formData: FormData,
): Promise<PrepItemActionState> {
  const t = await getTranslations("prepItemForm");
  const tripId = String(formData.get("tripId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const validation = validatePrepItemInput(formData);

  if (!isValidPrepItemId(tripId) || !isValidPrepItemId(taskId)) {
    return { message: t("actionErrors.identifyItem") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase } = await authenticatedClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("start_date")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return { message: t("actionErrors.identifyTrip") };
  }

  const { error } = await supabase
    .from("trip_tasks")
    .update({
      title: validation.data.title,
      owner_id: validation.data.assignedTo,
      item_type: validation.data.itemType,
      category: validation.data.category,
      continent: validation.data.continent,
      country: validation.data.country,
      city: validation.data.city,
      classification: validation.data.classification,
      is_critical: validation.data.classification === "required",
      due_offset_days: validation.data.dueOffsetDays,
      due_date: dateBeforeTrip(trip.start_date, validation.data.dueOffsetDays),
      currency: validation.data.currency,
      estimated_amount: validation.data.estimatedAmount,
      paid_amount: validation.data.paidAmount,
      document_instructions: validation.data.documentInstructions,
      itinerary_item_id: validation.data.itineraryItemId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("trip_id", tripId);

  if (error) {
    return { message: t("actionErrors.updateFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/organizer?trip=${tripId}`);
  return { success: true };
}
