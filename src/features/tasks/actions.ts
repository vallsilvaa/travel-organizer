"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { notifyTripCollaborators } from "@/features/notifications/collaboration";
import { createClient } from "@/lib/supabase/server";
import {
  isValidTaskId,
  validateTaskInput,
  type TaskFieldErrors,
} from "./validation";
import { dateBeforeTrip } from "./templates";
import {
  isValidPrepItemId,
  validatePrepItemInput,
  type PrepItemFieldErrors,
} from "./prep-item-validation";
import { validateItineraryInput, type ItineraryFieldErrors } from "@/features/itinerary/validation";
import { validateReservationInput, type ReservationFieldErrors } from "@/features/reservations/validation";

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

export type ConvertPrepTaskActionState = {
  reservationErrors?: ReservationFieldErrors;
  itineraryErrors?: ItineraryFieldErrors;
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
  const { data: created, error } = await supabase
    .from("trip_tasks")
    .insert({
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
    })
    .select("id")
    .single();

  if (error) {
    return { message: t("actionErrors.addFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "trip_task",
      entityId: created.id,
      action: "created",
      itemLabel: validation.data.title,
      tab: "preparation",
    }),
  );
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

  const { supabase, user } = await authenticatedClient();
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
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "trip_task",
      entityId: taskId,
      action: "updated",
      itemLabel: validation.data.title,
      tab: "preparation",
    }),
  );
  return { success: true };
}

export async function deleteTask(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");

  if (!isValidTaskId(tripId) || !isValidTaskId(taskId)) {
    return;
  }

  const { supabase, user } = await authenticatedClient();
  const { data: deleted } = await supabase
    .from("trip_tasks")
    .delete()
    .eq("id", taskId)
    .eq("trip_id", tripId)
    .select("title")
    .maybeSingle();
  revalidatePath(`/trips/${tripId}`);

  if (deleted) {
    after(() =>
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: user.id,
        entityType: "trip_task",
        entityId: taskId,
        action: "deleted",
        itemLabel: deleted.title,
        tab: "preparation",
      }),
    );
  }
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

// #210: after completing a governed prep item that already resulted in
// something concrete (e.g. "Comprar ingresso rei leao" -> bought the
// ticket), offer to turn it into a reservation and/or an itinerary item
// instead of the traveler re-typing the same title/cost/city elsewhere.
// Reuses the reservation and itinerary validation/insert paths as-is
// (including sync_reservation_expense) rather than duplicating their rules.
export async function convertPrepTaskOnCompletion(
  _previousState: ConvertPrepTaskActionState,
  formData: FormData,
): Promise<ConvertPrepTaskActionState> {
  const tI18n = await getTranslations("taskConversionDialog");
  const tItinerary = await getTranslations("itineraryForm");
  const tReservation = await getTranslations("reservationForm");
  const tripId = String(formData.get("tripId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const addItinerary = formData.get("addItinerary") === "true";
  const addReservation = formData.get("addReservation") === "true";

  if (!isValidPrepItemId(tripId) || !isValidPrepItemId(taskId)) {
    return { message: tI18n("actionErrors.identifyItem") };
  }

  const { supabase, user } = await authenticatedClient();

  // Marking the task complete happens here - when the visitor is done with
  // the dialog (Salvar) - rather than the moment the dialog opens. Doing it
  // earlier used to revalidate the trip page immediately, which could drop
  // this task's row (and the dialog mounted inside it) from the default
  // "open tasks" view before there was any time to check a box.
  await supabase.rpc("complete_prep_item", { p_task_id: taskId, p_should_complete: true });

  if (!addItinerary && !addReservation) {
    revalidatePath(`/trips/${tripId}`);
    return { success: true };
  }

  const { data: task } = await supabase
    .from("trip_tasks")
    .select("id, title, itinerary_item_id, reservation_id")
    .eq("id", taskId)
    .eq("trip_id", tripId)
    .single();

  if (!task) {
    return { message: tI18n("actionErrors.identifyItem") };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("start_date, end_date")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return { message: tI18n("actionErrors.identifyTrip") };
  }

  let itineraryItemId: string | null = task.itinerary_item_id;

  if (addItinerary) {
    const itineraryValidation = validateItineraryInput(formData);
    if (!itineraryValidation.success) {
      return { itineraryErrors: translateFieldErrors(tItinerary, itineraryValidation.errors) };
    }

    const endDate = trip.end_date ?? trip.start_date;
    if (itineraryValidation.data.date < trip.start_date || itineraryValidation.data.date > endDate) {
      return { itineraryErrors: { date: tItinerary("actionErrors.dateOutsideTripRange") } };
    }

    const { data: createdItem, error: itineraryError } = await supabase
      .from("itinerary_items")
      .insert({
        trip_id: tripId,
        item_date: itineraryValidation.data.date,
        title: task.title,
        location: itineraryValidation.data.location,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (itineraryError || !createdItem) {
      return { message: tI18n("actionErrors.addFailed") };
    }
    itineraryItemId = createdItem.id;

    after(() =>
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: user.id,
        entityType: "itinerary_item",
        entityId: createdItem.id,
        action: "created",
        itemLabel: task.title,
        tab: "itinerary",
      }),
    );
  }

  let reservationId: string | null = task.reservation_id;

  if (addReservation) {
    const reservationValidation = validateReservationInput(formData);
    if (!reservationValidation.success) {
      return { reservationErrors: translateFieldErrors(tReservation, reservationValidation.errors) };
    }

    const { data: createdReservation, error: reservationError } = await supabase
      .from("trip_reservations")
      .insert({
        trip_id: tripId,
        reservation_type: reservationValidation.data.reservationType,
        title: task.title,
        provider: reservationValidation.data.provider,
        confirmation_code: reservationValidation.data.confirmationCode,
        start_date: reservationValidation.data.startDate,
        start_time: reservationValidation.data.startTime,
        end_date: reservationValidation.data.endDate,
        end_time: reservationValidation.data.endTime,
        location: reservationValidation.data.location,
        destination_location: reservationValidation.data.destinationLocation,
        notes: reservationValidation.data.notes,
        itinerary_item_id: itineraryItemId,
        paid_amount: reservationValidation.data.paidAmount,
        currency: reservationValidation.data.currency,
        payment_status: reservationValidation.data.paymentStatus,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (reservationError || !createdReservation) {
      return { message: tI18n("actionErrors.addFailed") };
    }
    reservationId = createdReservation.id;

    await supabase.rpc("sync_reservation_expense", {
      p_reservation_id: reservationId,
      p_responsible_ids: reservationValidation.data.responsibleIds,
    });

    after(() =>
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: user.id,
        entityType: "reservation",
        entityId: reservationId!,
        action: "created",
        itemLabel: task.title,
        tab: "reservations",
      }),
    );
  }

  await supabase
    .from("trip_tasks")
    .update({ itinerary_item_id: itineraryItemId, reservation_id: reservationId })
    .eq("id", taskId)
    .eq("trip_id", tripId);

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
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

  const { supabase, user } = await authenticatedClient();
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
      action: validation.data.action,
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
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "trip_task",
      entityId: taskId,
      action: "updated",
      itemLabel: validation.data.title,
      tab: "preparation",
    }),
  );
  return { success: true };
}
