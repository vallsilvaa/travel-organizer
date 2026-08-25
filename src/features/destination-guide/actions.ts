"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isValidTripId } from "@/features/trips/validation";
import { validateDestinationGuideInput, type DestinationGuideFieldErrors } from "./validation";

export type UpdateDestinationGuideState = {
  errors?: DestinationGuideFieldErrors;
  message?: string;
  success?: boolean;
};

function destinationGuideErrorMessage(error: { message?: string }) {
  switch (error.message) {
    case "not_authorized":
      return "Somente quem criou a viagem ou um organizador pode editar o guia do destino.";
    case "trip_archived":
      return "Esta viagem está arquivada. Reative-a para editar o guia do destino.";
    default:
      return "Não foi possível salvar o guia do destino.";
  }
}

export async function updateDestinationGuide(
  _previousState: UpdateDestinationGuideState,
  formData: FormData,
): Promise<UpdateDestinationGuideState> {
  const tripId = String(formData.get("tripId") ?? "");
  if (!isValidTripId(tripId)) {
    return { message: "Não foi possível identificar a viagem." };
  }

  const validation = validateDestinationGuideInput(formData);
  if (!validation.success) {
    return { errors: validation.errors };
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
    return { message: destinationGuideErrorMessage(error) };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true, message: "Guia do destino atualizado com sucesso." };
}
