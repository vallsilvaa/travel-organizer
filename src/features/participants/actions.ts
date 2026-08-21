"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isValidParticipantId } from "./validation";

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

export async function removeParticipant(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const userId = String(formData.get("userId") ?? "");

  if (!isValidParticipantId(tripId) || !isValidParticipantId(userId)) {
    redirect(`/trips/${tripId}?tripError=invalid_participant`);
  }

  const { supabase, user } = await authenticatedClient();

  if (userId === user.id) {
    redirect(`/trips/${tripId}?tripError=cannot_remove_self`);
  }

  const { data: removed, error } = await supabase
    .from("trip_participants")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (error || !removed) {
    redirect(`/trips/${tripId}?tripError=remove_participant_not_allowed`);
  }

  revalidatePath(`/trips/${tripId}`);
}
