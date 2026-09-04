"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { notifyTripCollaborators } from "@/features/notifications/collaboration";
import { createClient } from "@/lib/supabase/server";
import {
  isValidItineraryId,
  validateItineraryInput,
  type ItineraryFieldErrors,
} from "./validation";

export type ItineraryActionState = {
  errors?: ItineraryFieldErrors;
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

export async function createItineraryItem(
  _previousState: ItineraryActionState,
  formData: FormData,
): Promise<ItineraryActionState> {
  const t = await getTranslations("itineraryForm");
  const tripId = String(formData.get("tripId") ?? "");
  const validation = validateItineraryInput(formData);

  if (!isValidItineraryId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();
  const { data: created, error } = await supabase
    .from("itinerary_items")
    .insert({
      trip_id: tripId,
      item_date: validation.data.date,
      start_time: validation.data.time,
      title: validation.data.title,
      location: validation.data.location,
      notes: validation.data.notes,
      period: validation.data.period,
      city: validation.data.city,
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
      entityType: "itinerary_item",
      entityId: created.id,
      action: "created",
      itemLabel: validation.data.title,
      tab: "itinerary",
    }),
  );
  return { success: true };
}

export async function updateItineraryItem(
  _previousState: ItineraryActionState,
  formData: FormData,
): Promise<ItineraryActionState> {
  const t = await getTranslations("itineraryForm");
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const validation = validateItineraryInput(formData);

  if (!isValidItineraryId(tripId) || !isValidItineraryId(itemId)) {
    return { message: t("actionErrors.identifyItem") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("itinerary_items")
    .update({
      item_date: validation.data.date,
      start_time: validation.data.time,
      title: validation.data.title,
      location: validation.data.location,
      notes: validation.data.notes,
      period: validation.data.period,
      city: validation.data.city,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
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
      entityType: "itinerary_item",
      entityId: itemId,
      action: "updated",
      itemLabel: validation.data.title,
      tab: "itinerary",
    }),
  );
  return { success: true };
}

export async function deleteItineraryItem(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  if (!isValidItineraryId(tripId) || !isValidItineraryId(itemId)) {
    return;
  }

  const { supabase, user } = await authenticatedClient();
  const { data: deleted } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itemId)
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
        entityType: "itinerary_item",
        entityId: itemId,
        action: "deleted",
        itemLabel: deleted.title,
        tab: "itinerary",
      }),
    );
  }
}
