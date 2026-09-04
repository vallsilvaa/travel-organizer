"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { notifyTripCollaborators } from "@/features/notifications/collaboration";
import { createClient } from "@/lib/supabase/server";
import { dateBeforeTrip } from "@/features/tasks/templates";
import {
  isValidTemplateId,
  validateTemplateInput,
  type TemplateFieldErrors,
} from "./validation";

export type TemplateActionState = {
  errors?: TemplateFieldErrors;
  message?: string;
  success?: boolean;
};

export type ApplyTemplateActionState = {
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

export async function createTemplate(
  _previousState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const t = await getTranslations("templateForm");
  const validation = validateTemplateInput(formData);

  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("prep_item_templates").insert({
    owner_id: user.id,
    title: validation.data.title,
    item_type: validation.data.itemType,
    category: validation.data.category,
    continent: validation.data.continent,
    country: validation.data.country,
    city: validation.data.city,
    classification: validation.data.classification,
    due_offset_days: validation.data.dueOffsetDays,
    currency: validation.data.currency,
    estimated_amount: validation.data.estimatedAmount,
    document_instructions: validation.data.documentInstructions,
  });

  if (error) {
    return { message: t("actionErrors.addFailed") };
  }

  revalidatePath("/organizer");
  return { success: true };
}

export async function updateTemplate(
  _previousState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const t = await getTranslations("templateForm");
  const templateId = String(formData.get("templateId") ?? "");
  const validation = validateTemplateInput(formData);

  if (!isValidTemplateId(templateId)) {
    return { message: t("actionErrors.identifyTemplate") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("prep_item_templates")
    .update({
      title: validation.data.title,
      item_type: validation.data.itemType,
      category: validation.data.category,
      continent: validation.data.continent,
      country: validation.data.country,
      city: validation.data.city,
      classification: validation.data.classification,
      due_offset_days: validation.data.dueOffsetDays,
      currency: validation.data.currency,
      estimated_amount: validation.data.estimatedAmount,
      document_instructions: validation.data.documentInstructions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("owner_id", user.id);

  if (error) {
    return { message: t("actionErrors.updateFailed") };
  }

  revalidatePath("/organizer");
  return { success: true };
}

export async function deleteTemplate(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");

  if (!isValidTemplateId(templateId)) {
    return;
  }

  const { supabase, user } = await authenticatedClient();
  await supabase
    .from("prep_item_templates")
    .delete()
    .eq("id", templateId)
    .eq("owner_id", user.id);

  revalidatePath("/organizer");
}

export async function applyPrepTemplate(
  _previousState: ApplyTemplateActionState,
  formData: FormData,
): Promise<ApplyTemplateActionState> {
  const t = await getTranslations("organizerPanel.applyForm");
  const tripId = String(formData.get("tripId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const rawAssignedTo = String(formData.get("assignedTo") ?? "").trim();
  const assignedTo = rawAssignedTo && rawAssignedTo !== "none" ? rawAssignedTo : null;
  const rawItineraryItemId = String(formData.get("itineraryItemId") ?? "").trim();
  const itineraryItemId = rawItineraryItemId && rawItineraryItemId !== "none" ? rawItineraryItemId : null;

  if (!isValidTemplateId(tripId) || !isValidTemplateId(templateId)) {
    return { message: t("identifyError") };
  }

  const { supabase, user } = await authenticatedClient();

  const { data: template, error: templateError } = await supabase
    .from("prep_item_templates")
    .select(
      "id, title, item_type, category, continent, country, city, classification, due_offset_days, currency, estimated_amount, document_instructions",
    )
    .eq("id", templateId)
    .single();

  if (templateError || !template) {
    return { message: t("templateNotFound") };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, start_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return { message: t("tripNotFound") };
  }

  const dueDate = dateBeforeTrip(trip.start_date, template.due_offset_days);

  const { data: created, error } = await supabase
    .from("trip_tasks")
    .insert({
      trip_id: tripId,
      title: template.title,
      owner_id: assignedTo,
      due_date: dueDate,
      due_offset_days: template.due_offset_days,
      item_type: template.item_type,
      category: template.category,
      continent: template.continent,
      country: template.country,
      city: template.city,
      classification: template.classification,
      is_critical: template.classification === "required",
      currency: template.currency,
      estimated_amount: template.estimated_amount,
      document_instructions: template.document_instructions,
      itinerary_item_id: itineraryItemId,
      template_id: template.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { message: t("applyFailed") };
  }

  revalidatePath(`/organizer?trip=${tripId}`);
  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "trip_task",
      entityId: created.id,
      action: "created",
      itemLabel: template.title,
      tab: "preparation",
    }),
  );
  return { success: true };
}
