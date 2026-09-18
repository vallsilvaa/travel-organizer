"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { createClient } from "@/lib/supabase/server";
import {
  isValidTripId,
  summarizeDestinations,
  validateCoverImageUpload,
  validateTripInput,
  type DestinationInput,
  type TripFieldErrors,
} from "./validation";
import { sanitizeFileNameForStorage } from "@/features/attachments/validation";
import { inviteParticipant } from "@/features/invitations/actions";
import { applyTemplateRowToTrip, type TemplateRow } from "@/features/prep-catalog/actions";
import { isValidTemplateId } from "@/features/prep-catalog/validation";

export type CreateTripState = {
  errors?: TripFieldErrors;
  message?: string;
  success?: boolean;
};

function toDestinationRows(tripId: string, destinations: DestinationInput[]) {
  return destinations.map((destination, position) => ({
    trip_id: tripId,
    label: destination.label,
    city: destination.city,
    country: destination.country,
    continent: destination.continent,
    granularity: destination.granularity,
    position,
  }));
}

export async function createTrip(
  _previousState: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const t = await getTranslations("trip.editForm");
  // A brand-new trip's start date must lie in the future - once saved, the
  // creator can freely correct dates even on a trip already under way (see
  // updateTrip, which doesn't pass this option).
  const validation = validateTripInput(formData, { requireFutureStartDate: true });

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
    title: validation.data.title,
    // The legacy free-text column is kept as an auto-derived summary of the
    // structured destinations below, so every existing reader of
    // trip.destination keeps working unchanged.
    destination: summarizeDestinations(validation.data.destinations),
    start_date: validation.data.startDate,
    end_date: validation.data.endDate,
    timezone: validation.data.timezone,
    created_by: user.id,
  });

  if (error) {
    return { message: t("actionErrors.createFailed") };
  }

  const { error: destinationsError } = await supabase
    .from("trip_destinations")
    .insert(toDestinationRows(tripId, validation.data.destinations));

  if (destinationsError) {
    // Best-effort rollback so a half-created trip (title/dates but no
    // destinations) never lingers for the creator to stumble onto.
    await supabase.from("trips").delete().eq("id", tripId);
    return { message: t("actionErrors.destinationsSaveFailed") };
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
          "id, title, action, item_type, category, continent, country, city, classification, due_offset_days, currency, estimated_amount, document_instructions",
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
      title: validation.data.title,
      destination: summarizeDestinations(validation.data.destinations),
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

  // Destinations have no stable identity across a full form re-submit, so
  // the whole set is replaced rather than diffed.
  await supabase.from("trip_destinations").delete().eq("trip_id", tripId);
  const { error: destinationsError } = await supabase
    .from("trip_destinations")
    .insert(toDestinationRows(tripId, validation.data.destinations));

  if (destinationsError) {
    return { message: t("actionErrors.destinationsSaveFailed") };
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

export type CoverImageActionState = {
  message?: string;
  success?: boolean;
};

function coverImageRpcErrorMessage(
  t: Awaited<ReturnType<typeof getTranslations<"coverImage">>>,
  error: { message?: string },
) {
  switch (error.message) {
    case "not_authorized":
      return t("actionErrors.notAuthorized");
    case "trip_archived":
      return t("actionErrors.tripArchived");
    default:
      return t("actionErrors.genericFailed");
  }
}

export async function updateTripCoverImage(
  _previousState: CoverImageActionState,
  formData: FormData,
): Promise<CoverImageActionState> {
  const t = await getTranslations("coverImage");
  const tripId = String(formData.get("tripId") ?? "");
  if (!isValidTripId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }

  const file = formData.get("file");
  const validation = validateCoverImageUpload(file instanceof File ? file : null);
  if (!validation.success) {
    return { message: t(`actionErrors.${validation.error}`) };
  }

  const uploadedFile = file as File;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("cover_image_path")
    .eq("id", tripId)
    .maybeSingle();
  const previousPath = (trip as { cover_image_path: string | null } | null)?.cover_image_path ?? null;

  const storagePath = `${tripId}/cover-${crypto.randomUUID()}-${sanitizeFileNameForStorage(uploadedFile.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("trip-attachments")
    .upload(storagePath, uploadedFile, { contentType: uploadedFile.type });

  if (uploadError) {
    return { message: t("actionErrors.uploadFailed") };
  }

  const { error: rpcError } = await supabase.rpc("update_trip_cover_image", {
    p_trip_id: tripId,
    p_cover_image_path: storagePath,
  });

  if (rpcError) {
    await supabase.storage.from("trip-attachments").remove([storagePath]);
    return { message: coverImageRpcErrorMessage(t, rpcError) };
  }

  if (previousPath) {
    await supabase.storage.from("trip-attachments").remove([previousPath]);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/trips/${tripId}`);
  return { success: true, message: t("actionErrors.updated") };
}

export async function removeTripCoverImage(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  if (!isValidTripId(tripId)) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("cover_image_path")
    .eq("id", tripId)
    .maybeSingle();
  const previousPath = (trip as { cover_image_path: string | null } | null)?.cover_image_path ?? null;

  const { error } = await supabase.rpc("update_trip_cover_image", {
    p_trip_id: tripId,
    p_cover_image_path: null,
  });

  if (!error && previousPath) {
    await supabase.storage.from("trip-attachments").remove([previousPath]);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/trips/${tripId}`);
}
