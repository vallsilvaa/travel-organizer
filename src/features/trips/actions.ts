"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { createClient } from "@/lib/supabase/server";
import { isValidTripId, validateTripInput, type TripFieldErrors } from "./validation";
import { inviteParticipant } from "@/features/invitations/actions";
import { applyTemplateRowToTrip, type TemplateRow } from "@/features/prep-catalog/actions";
import { isValidTemplateId } from "@/features/prep-catalog/validation";

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

  // Creating a trip is how an account becomes an organizer (issue #150) -
  // grants the global capability the same way it's always implicitly
  // worked (anyone could create a trip and thereby organize it), just now
  // also recorded so /organizer and the post-login redirect can use it.
  await supabase.from("profiles").update({ is_organizer: true }).eq("id", user.id);

  // Creating a trip from the Organizer Panel (#154) also: registers the
  // creator's own trip_participants row as 'organizer' instead of the
  // trigger's default 'traveler' (the traveler-flow default is left
  // untouched - the rest of the app already treats "creator" as
  // effectively-organizer regardless of that row), optionally copies
  // selected catalog tasks into the new trip, and optionally sends a
  // traveler invite. None of that redirects away - the panel stays put
  // and revalidates so the new trip's card just appears in the list.
  if (formData.get("organizerContext") === "true") {
    await supabase
      .from("trip_participants")
      .update({ role: "organizer" })
      .eq("trip_id", tripId)
      .eq("user_id", user.id);

    const partialErrors: string[] = [];

    const taskTemplateIds = formData.getAll("taskTemplateIds").map(String).filter(isValidTemplateId);
    if (taskTemplateIds.length) {
      const { data: templates } = await supabase
        .from("prep_item_templates")
        .select(
          "id, title, item_type, category, continent, country, city, classification, due_offset_days, currency, estimated_amount, document_instructions",
        )
        .in("id", taskTemplateIds);

      for (const template of (templates ?? []) as TemplateRow[]) {
        const applied = await applyTemplateRowToTrip({
          supabase,
          userId: user.id,
          template,
          tripId,
          assignedTo: null,
          itineraryItemId: null,
          rawItemDate: "",
        });
        if (!applied.ok) {
          partialErrors.push(t("actionErrors.taskApplyFailed", { title: template.title }));
        }
      }
    }

    const inviteEmail = String(formData.get("inviteEmail") ?? "").trim();
    if (inviteEmail) {
      const inviteFormData = new FormData();
      inviteFormData.set("tripId", tripId);
      inviteFormData.set("email", inviteEmail);
      inviteFormData.set("role", "traveler");
      const inviteResult = await inviteParticipant({}, inviteFormData);
      if (inviteResult.error) {
        partialErrors.push(inviteResult.error);
      }
    }

    revalidatePath("/organizer");

    return {
      success: true,
      message: partialErrors.length
        ? `${t("actionErrors.createdWithIssues")} ${partialErrors.join(" ")}`
        : t("actionErrors.created"),
    };
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
