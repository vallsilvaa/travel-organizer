"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  const tripId = String(formData.get("tripId") ?? "");
  const validation = validateItineraryInput(formData);

  if (!isValidItineraryId(tripId)) {
    return { message: "The trip could not be identified." };
  }
  if (!validation.success) {
    return { errors: validation.errors };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("itinerary_items").insert({
    trip_id: tripId,
    item_date: validation.data.date,
    start_time: validation.data.time,
    title: validation.data.title,
    location: validation.data.location,
    notes: validation.data.notes,
    created_by: user.id,
  });

  if (error) {
    return { message: "We could not add this itinerary item. Check your trip access and try again." };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function updateItineraryItem(
  _previousState: ItineraryActionState,
  formData: FormData,
): Promise<ItineraryActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const validation = validateItineraryInput(formData);

  if (!isValidItineraryId(tripId) || !isValidItineraryId(itemId)) {
    return { message: "The itinerary item could not be identified." };
  }
  if (!validation.success) {
    return { errors: validation.errors };
  }

  const { supabase } = await authenticatedClient();
  const { error } = await supabase
    .from("itinerary_items")
    .update({
      item_date: validation.data.date,
      start_time: validation.data.time,
      title: validation.data.title,
      location: validation.data.location,
      notes: validation.data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("trip_id", tripId);

  if (error) {
    return { message: "We could not update this itinerary item. Try again." };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteItineraryItem(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  if (!isValidItineraryId(tripId) || !isValidItineraryId(itemId)) {
    return;
  }

  const { supabase } = await authenticatedClient();
  await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itemId)
    .eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
}
