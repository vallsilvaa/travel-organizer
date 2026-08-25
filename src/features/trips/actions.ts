"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { createClient } from "@/lib/supabase/server";
import { isValidTripId, validateTripInput, type TripFieldErrors } from "./validation";
import { buildEnglandPreparationTasks, isEnglandDestination } from "@/features/tasks/templates";

export type CreateTripState = {
  errors?: TripFieldErrors;
  message?: string;
  success?: boolean;
};

export async function createTrip(
  _previousState: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const t = await getTranslations("trip.editForm");
  const validation = validateTripInput(formData);

  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const tripId = randomUUID();
  const { error } = await supabase.from("trips").insert({
    id: tripId,
    destination: validation.data.destination,
    start_date: validation.data.startDate,
    end_date: validation.data.endDate,
    timezone: validation.data.timezone,
    created_by: user.id,
  });

  if (error) {
    return { message: t("actionErrors.createFailed") };
  }

  if (isEnglandDestination(validation.data.destination)) {
    await supabase.from("trip_tasks").insert(
      buildEnglandPreparationTasks(tripId, validation.data.startDate, user.id),
    );
  }

  revalidatePath("/dashboard");
  redirect(`/trips/${tripId}`);
}

export async function updateTrip(
  _previousState: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const t = await getTranslations("trip.editForm");
  const tripId = String(formData.get("tripId") ?? "");
  if (!isValidTripId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }

  const validation = validateTripInput(formData);
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: updatedTrip, error } = await supabase
    .from("trips")
    .update({
      destination: validation.data.destination,
      start_date: validation.data.startDate,
      end_date: validation.data.endDate,
      timezone: validation.data.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tripId)
    .eq("created_by", user.id)
    .select("id")
    .maybeSingle();

  if (error || !updatedTrip) {
    return { message: t("actionErrors.onlyCreatorCanEdit") };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/trips/${tripId}`);
  return { success: true, message: t("actionErrors.updated") };
}

async function setTripArchived(formData: FormData, archived: boolean): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  if (!isValidTripId(tripId)) {
    redirect("/dashboard?tripError=invalid_trip");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: updatedTrip, error } = await supabase
    .from("trips")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", tripId)
    .eq("created_by", user.id)
    .select("id")
    .maybeSingle();

  if (error || !updatedTrip) {
    redirect(`/trips/${tripId}?tripError=archive_not_allowed`);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/trips/${tripId}`);
}

export async function archiveTrip(formData: FormData): Promise<void> {
  await setTripArchived(formData, true);
}

export async function restoreTrip(formData: FormData): Promise<void> {
  await setTripArchived(formData, false);
}

export async function deleteTrip(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  if (!isValidTripId(tripId)) {
    redirect("/dashboard?tripError=invalid_trip");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: deletedTrip, error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("created_by", user.id)
    .select("id")
    .maybeSingle();

  if (error || !deletedTrip) {
    redirect(`/trips/${tripId}?tripError=delete_not_allowed`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
