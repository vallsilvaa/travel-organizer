"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { buildInvitationEmail } from "./email";
import {
  isValidInvitationEmail,
  isValidInvitationId,
  normalizeInvitationEmail,
} from "./validation";

export type InviteOrganizerState = {
  error?: string;
  message?: string;
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

async function sendInvitationEmail(email: string, tripDestination: string, invitedByName: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.REMINDER_EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!resendApiKey || !emailFrom || !appUrl) {
    console.error("Invitation email not sent: email service is not configured");
    return false;
  }

  const message = buildInvitationEmail({ appUrl, tripDestination, invitedByName });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      console.error("Invitation email delivery failed", { status: response.status });
      return false;
    }

    return true;
  } catch {
    console.error("Invitation email delivery failed", { code: "network_error" });
    return false;
  }
}

export async function inviteOrganizer(
  _previousState: InviteOrganizerState,
  formData: FormData,
): Promise<InviteOrganizerState> {
  const tripId = String(formData.get("tripId") ?? "");
  const email = normalizeInvitationEmail(formData.get("email"));

  if (!isValidInvitationId(tripId)) {
    return { error: "Não foi possível identificar a viagem." };
  }
  if (!isValidInvitationEmail(email)) {
    return { error: "Informe um e-mail válido." };
  }

  const { supabase, user } = await authenticatedClient();

  if (user.email?.toLowerCase() === email) {
    return { error: "Você já tem acesso a esta viagem." };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, destination")
    .eq("id", tripId)
    .eq("created_by", user.id)
    .single();

  if (tripError || !trip) {
    return { error: "Somente quem criou a viagem pode enviar convites." };
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
          ? "Já existe um convite pendente para este e-mail."
          : "Não foi possível criar o convite. Tente novamente.",
    };
  }

  revalidatePath(`/trips/${tripId}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const delivered = await sendInvitationEmail(
    email,
    trip.destination,
    profile?.display_name ?? "Um organizador",
  );

  return {
    message: delivered
      ? `Convite enviado para ${email}.`
      : `Convite criado para ${email}, mas não foi possível enviar o e-mail agora. Você pode reenviar em instantes.`,
  };
}

export async function resendInvitation(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");

  if (!isValidInvitationId(tripId) || !isValidInvitationId(invitationId)) {
    redirect(`/trips/${tripId}?tripError=invalid_invitation`);
  }

  const { supabase, user } = await authenticatedClient();

  const { data: invitation, error } = await supabase
    .from("trip_invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", invitationId)
    .eq("trip_id", tripId)
    .eq("status", "pending")
    .select("email, trip_destination")
    .maybeSingle();

  if (error || !invitation) {
    redirect(`/trips/${tripId}?tripError=resend_invitation_not_allowed`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  await sendInvitationEmail(
    invitation.email,
    invitation.trip_destination,
    profile?.display_name ?? "Um organizador",
  );

  revalidatePath(`/trips/${tripId}`);
}

export async function cancelInvitation(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");

  if (!isValidInvitationId(tripId) || !isValidInvitationId(invitationId)) {
    redirect(`/trips/${tripId}?tripError=invalid_invitation`);
  }

  const { supabase } = await authenticatedClient();

  const { data: cancelled, error } = await supabase
    .from("trip_invitations")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("trip_id", tripId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !cancelled) {
    redirect(`/trips/${tripId}?tripError=cancel_invitation_not_allowed`);
  }

  revalidatePath(`/trips/${tripId}`);
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
