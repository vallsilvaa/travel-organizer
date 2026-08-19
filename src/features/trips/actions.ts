"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { validateTripInput, type TripFieldErrors } from "./validation";
import { buildEnglandPreparationTasks, isEnglandDestination } from "@/features/tasks/templates";

export type CreateTripState = {
  errors?: TripFieldErrors;
  message?: string;
};

export async function createTrip(
  _previousState: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const validation = validateTripInput(formData);

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

  const tripId = randomUUID();
  const { error } = await supabase.from("trips").insert({
    id: tripId,
    destination: validation.data.destination,
    start_date: validation.data.startDate,
    end_date: validation.data.endDate,
    created_by: user.id,
  });

  if (error) {
    return { message: "Não foi possível criar a viagem. Tente novamente." };
  }

  if (isEnglandDestination(validation.data.destination)) {
    await supabase.from("trip_tasks").insert(
      buildEnglandPreparationTasks(tripId, validation.data.startDate, user.id),
    );
  }

  revalidatePath("/dashboard");
  redirect(`/trips/${tripId}`);
}
