"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { notifyTripCollaborators } from "@/features/notifications/collaboration";
import { createClient } from "@/lib/supabase/server";
import { dateBeforeTrip, type TaskCategory } from "@/features/tasks/templates";
import {
  isValidTemplateId,
  validateTemplateInput,
  type TemplateFieldErrors,
} from "./validation";
import type { Classification, Continent, PrepItemType } from "./shared";

export type TemplateActionState = {
  errors?: TemplateFieldErrors;
  message?: string;
  success?: boolean;
};

export type ApplyTemplateActionState = {
  message?: string;
  success?: boolean;
  appliedCount?: number;
  duplicateCount?: number;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type TemplateRow = {
  id: string;
  title: string;
  action: string | null;
  item_type: PrepItemType;
  category: TaskCategory;
  continent: Continent | null;
  country: string;
  city: string | null;
  classification: Classification;
  due_offset_days: number | null;
  currency: string | null;
  estimated_amount: string | null;
  document_instructions: string | null;
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

export type ApplyResult =
  | { ok: true }
  | { ok: false; reason: "trip_not_found" | "insert_failed" | "duplicate" };

export async function applyTemplateRowToTrip({
  supabase,
  userId,
  template,
  tripId,
  assignedTo,
  itineraryItemId,
  rawItemDate,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  template: TemplateRow;
  tripId: string;
  assignedTo: string | null;
  itineraryItemId: string | null;
  rawItemDate: string;
}): Promise<ApplyResult> {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, start_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return { ok: false, reason: "trip_not_found" };
  }

  // "Item de roteiro" templates apply into the itinerary, not the
  // preparation checklist (#149) - a structurally different target table,
  // since itinerary_items has no notion of a relative lead time, only an
  // absolute date.
  if (template.item_type === "itinerary_item") {
    const itemDate = /^\d{4}-\d{2}-\d{2}$/.test(rawItemDate) ? rawItemDate : trip.start_date;

    const { data: createdItem, error: itineraryError } = await supabase
      .from("itinerary_items")
      .insert({
        trip_id: tripId,
        item_date: itemDate,
        title: template.title,
        city: template.city,
        action: template.action,
        template_id: template.id,
        created_by: userId,
      })
      .select("id")
      .single();

    if (itineraryError) {
      // #229 (D3): unlike the trip_tasks branch below, there is no longer a
      // per-trip uniqueness constraint here - the same itinerary template
      // can be applied to the same trip on multiple days on purpose. This
      // still maps 23505 to "duplicate" in case some other future unique
      // constraint on itinerary_items fires, but in practice this branch
      // should only ever see "insert_failed" today.
      return { ok: false, reason: itineraryError.code === "23505" ? "duplicate" : "insert_failed" };
    }

    revalidatePath("/organizer");
    revalidatePath(`/trips/${tripId}`);
    after(() =>
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: userId,
        entityType: "itinerary_item",
        entityId: createdItem.id,
        action: "created",
        itemLabel: template.title,
        tab: "itinerary",
      }),
    );
    return { ok: true };
  }

  const dueDate = template.due_offset_days
    ? dateBeforeTrip(trip.start_date, template.due_offset_days)
    : null;

  const { data: created, error } = await supabase
    .from("trip_tasks")
    .insert({
      trip_id: tripId,
      title: template.title,
      action: template.action,
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
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    // The template is already active on this trip (#171) - the partial
    // unique index on (trip_id, template_id) is the source of truth for
    // this, catching concurrent/racing applies the UI check can't.
    return { ok: false, reason: error.code === "23505" ? "duplicate" : "insert_failed" };
  }

  revalidatePath("/organizer");
  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: userId,
      entityType: "trip_task",
      entityId: created.id,
      action: "created",
      itemLabel: template.title,
      tab: "preparation",
    }),
  );
  return { ok: true };
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
  const { data: created, error } = await supabase
    .from("prep_item_templates")
    .insert({
      owner_id: user.id,
      title: validation.data.title,
      action: validation.data.action,
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
    })
    .select(
      "id, title, action, item_type, category, continent, country, city, classification, due_offset_days, currency, estimated_amount, document_instructions",
    )
    .single();

  if (error || !created) {
    return { message: t("actionErrors.addFailed") };
  }

  revalidatePath("/organizer");

  // Creating a task from within a trip (#152) both saves it to the
  // catalog above and adds a copy to that trip in the same action -
  // "sem duplicação" means one submit, not a create-then-separately-apply
  // round trip. The template itself is still saved even if this second
  // step fails, so that's surfaced as a distinct partial-success message
  // rather than losing the catalog save.
  const tripId = String(formData.get("tripId") ?? "").trim();
  if (isValidTemplateId(tripId)) {
    const applied = await applyTemplateRowToTrip({
      supabase,
      userId: user.id,
      template: created as TemplateRow,
      tripId,
      assignedTo: null,
      itineraryItemId: null,
      rawItemDate: "",
    });

    if (!applied.ok) {
      return { success: true, message: t("actionErrors.addedButApplyFailed") };
    }
  }

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
      action: validation.data.action,
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

export async function applyPrepTemplates(
  _previousState: ApplyTemplateActionState,
  formData: FormData,
): Promise<ApplyTemplateActionState> {
  const t = await getTranslations("organizerPanel.applyForm");
  const tripId = String(formData.get("tripId") ?? "");
  const templateIds = formData.getAll("templateIds").map((value) => String(value));

  if (!isValidTemplateId(tripId) || templateIds.length === 0 || !templateIds.every(isValidTemplateId)) {
    return { message: t("identifyError") };
  }

  const { supabase, user } = await authenticatedClient();

  const { data: templates, error: templatesError } = await supabase
    .from("prep_item_templates")
    .select(
      "id, title, action, item_type, category, continent, country, city, classification, due_offset_days, currency, estimated_amount, document_instructions",
    )
    .in("id", templateIds);

  if (templatesError || !templates?.length) {
    return { message: t("templateNotFound") };
  }

  let appliedCount = 0;
  let duplicateCount = 0;
  let tripNotFound = false;
  let otherFailure = false;

  for (const template of templates as TemplateRow[]) {
    const applied = await applyTemplateRowToTrip({
      supabase,
      userId: user.id,
      template,
      tripId,
      assignedTo: null,
      itineraryItemId: null,
      rawItemDate: "",
    });

    if (applied.ok) {
      appliedCount += 1;
    } else if (applied.reason === "duplicate") {
      duplicateCount += 1;
    } else if (applied.reason === "trip_not_found") {
      tripNotFound = true;
    } else {
      otherFailure = true;
    }
  }

  if (appliedCount === 0) {
    const message = tripNotFound
      ? t("tripNotFound")
      : duplicateCount > 0 && !otherFailure
        ? t("alreadyAdded")
        : t("applyFailed");
    return { message, duplicateCount };
  }

  return { success: true, appliedCount, duplicateCount };
}
