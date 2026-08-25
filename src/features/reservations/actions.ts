"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { createClient } from "@/lib/supabase/server";
import {
  isValidReservationId,
  validateReservationInput,
  type ReservationFieldErrors,
} from "./validation";

export type ReservationActionState = {
  errors?: ReservationFieldErrors;
  message?: string;
  success?: boolean;
};

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  return { supabase, user };
}

export async function createReservation(
  _previousState: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const t = await getTranslations("reservationForm");
  const tripId = String(formData.get("tripId") ?? "");
  const validation = validateReservationInput(formData);

  if (!isValidReservationId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("trip_reservations").insert({
    trip_id: tripId,
    reservation_type: validation.data.reservationType,
    title: validation.data.title,
    provider: validation.data.provider,
    confirmation_code: validation.data.confirmationCode,
    start_date: validation.data.startDate,
    start_time: validation.data.startTime,
    end_date: validation.data.endDate,
    end_time: validation.data.endTime,
    location: validation.data.location,
    destination_location: validation.data.destinationLocation,
    notes: validation.data.notes,
    itinerary_item_id: validation.data.itineraryItemId,
    created_by: user.id,
  });

  if (error) {
    return { message: t("actionErrors.addFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function updateReservation(
  _previousState: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const t = await getTranslations("reservationForm");
  const tripId = String(formData.get("tripId") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");
  const validation = validateReservationInput(formData);

  if (!isValidReservationId(tripId) || !isValidReservationId(reservationId)) {
    return { message: t("actionErrors.identifyReservation") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase } = await authenticatedClient();
  const { error } = await supabase
    .from("trip_reservations")
    .update({
      reservation_type: validation.data.reservationType,
      title: validation.data.title,
      provider: validation.data.provider,
      confirmation_code: validation.data.confirmationCode,
      start_date: validation.data.startDate,
      start_time: validation.data.startTime,
      end_date: validation.data.endDate,
      end_time: validation.data.endTime,
      location: validation.data.location,
      destination_location: validation.data.destinationLocation,
      notes: validation.data.notes,
      itinerary_item_id: validation.data.itineraryItemId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("trip_id", tripId);

  if (error) {
    return { message: t("actionErrors.updateFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteReservation(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");

  if (!isValidReservationId(tripId) || !isValidReservationId(reservationId)) {
    return;
  }

  const { supabase } = await authenticatedClient();
  await supabase
    .from("trip_reservations")
    .delete()
    .eq("id", reservationId)
    .eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
}
