"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { createClient } from "@/lib/supabase/server";
import { isValidTripId } from "@/features/trips/validation";
import { validateDestinationGuideInput, type DestinationGuideFieldErrors } from "./validation";

export type UpdateDestinationGuideState = {
  errors?: DestinationGuideFieldErrors;
  message?: string;
  success?: boolean;
};

function destinationGuideErrorMessage(
  t: Awaited<ReturnType<typeof getTranslations<"destinationGuideForm">>>,
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

export async function updateDestinationGuide(
  _previousState: UpdateDestinationGuideState,
  formData: FormData,
): Promise<UpdateDestinationGuideState> {
  const t = await getTranslations("destinationGuideForm");
  const tripId = String(formData.get("tripId") ?? "");
  if (!isValidTripId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }

  const validation = validateDestinationGuideInput(formData);
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

  const { error } = await supabase.rpc("update_destination_guide", {
    p_trip_id: tripId,
    p_content: validation.data.content,
    p_source: validation.data.source,
    p_reviewed_at: validation.data.reviewedAt,
  });

  if (error) {
    return { message: destinationGuideErrorMessage(t, error) };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true, message: t("actionErrors.updated") };
}
