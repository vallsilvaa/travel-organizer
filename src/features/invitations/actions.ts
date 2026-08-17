"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  isValidInvitationEmail,
  isValidInvitationId,
  normalizeInvitationEmail,
} from "./validation";

export type InviteOrganizerState = {
  error?: string;
  message?: string;
};

export async function inviteOrganizer(
  _previousState: InviteOrganizerState,
  formData: FormData,
): Promise<InviteOrganizerState> {
  const tripId = String(formData.get("tripId") ?? "");
  const email = normalizeInvitationEmail(formData.get("email"));

  if (!isValidInvitationId(tripId)) {
    return { error: "The trip could not be identified." };
  }
  if (!isValidInvitationEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }
  if (user.email?.toLowerCase() === email) {
    return { error: "You already have access to this trip." };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, destination")
    .eq("id", tripId)
    .eq("created_by", user.id)
    .single();

  if (tripError || !trip) {
    return { error: "Only the traveler who created the trip can send invitations." };
  }

  const { error } = await supabase.from("trip_invitations").insert({
    trip_id: trip.id,
    trip_destination: trip.destination,
    email,
    invited_by: user.id,
    role: "organizer",
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "A pending invitation already exists for this email."
          : "We could not create the invitation. Try again.",
    };
  }

  revalidatePath(`/trips/${tripId}`);
  return { message: `Invitation sent to ${email}.` };
}

export async function respondToInvitation(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  const response = String(formData.get("response") ?? "");

  if (
    !isValidInvitationId(invitationId) ||
    (response !== "accepted" && response !== "declined")
  ) {
    redirect("/dashboard?invitationError=invalid_invitation");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: invitation, error } = await supabase
    .from("trip_invitations")
    .update({
      status: response,
      responded_at: new Date().toISOString(),
      invited_user_id: user.id,
    })
    .eq("id", invitationId)
    .eq("status", "pending")
    .select("trip_id")
    .single();

  if (error || !invitation) {
    redirect("/dashboard?invitationError=invitation_unavailable");
  }

  revalidatePath("/dashboard");
  revalidatePath(`/trips/${invitation.trip_id}`);

  if (response === "accepted") {
    redirect(`/trips/${invitation.trip_id}`);
  }

  redirect("/dashboard");
}
