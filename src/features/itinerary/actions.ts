"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { translateFieldErrors } from "@/i18n/translate-field-errors";
import { notifyTripCollaborators } from "@/features/notifications/collaboration";
import { createClient } from "@/lib/supabase/server";
import {
  isValidItineraryId,
  validateItineraryInput,
  type ItineraryFieldErrors,
} from "./validation";

export type ItineraryActionState = {
  errors?: ItineraryFieldErrors;
  message?: string;
  success?: boolean;
};

export type NewItineraryItemActionState = {
  errors?: ItineraryFieldErrors;
  message?: string;
  success?: boolean;
  // Only set on a "full" save (item + template) - drives switching the
  // active day-tab to the day the new item landed on (#231/R04). Absent on
  // a "Salvar só como modelo" success, since no item (and so no day) was
  // created.
  createdDate?: string;
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

async function validateDateWithinTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  date: string,
): Promise<"identifyTrip" | "dateOutsideTripRange" | null> {
  const { data: trip } = await supabase
    .from("trips")
    .select("start_date, end_date")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return "identifyTrip";
  }

  // Trips without an end_date only have a single valid day - their
  // start_date (#171) - rather than an open-ended range.
  const endDate = trip.end_date ?? trip.start_date;
  if (date < trip.start_date || date > endDate) {
    return "dateOutsideTripRange";
  }

  return null;
}

type TemplateFields = {
  title: string;
  location: string | null;
  city: string | null;
  country: string | null;
  continent: string | null;
};

// #231 (R04): "Salvar" and "Salvar só como modelo" both upsert a reusable
// itinerary_item template instead of ever creating a duplicate - the unique
// index added in 20260920000000 is (owner_id, lower(trim(title)),
// coalesce(lower(trim(location)), '')), scoped to item_type =
// 'itinerary_item'. PostgREST's upsert only takes plain column names for
// `on_conflict`, not the expression index above, so this does the
// select-then-insert-or-reuse by hand instead - title/location can contain
// `%`/`_` (LIKE wildcards), so matching is done in JS against every one of
// this owner's itinerary_item templates rather than via `.ilike()`.
async function findExistingItineraryTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  title: string,
  location: string | null,
): Promise<{ id: string } | null> {
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedLocation = (location ?? "").trim().toLowerCase();

  const { data: candidates } = await supabase
    .from("prep_item_templates")
    .select("id, title, location")
    .eq("owner_id", ownerId)
    .eq("item_type", "itinerary_item");

  const existing = candidates?.find(
    (candidate) =>
      candidate.title.trim().toLowerCase() === normalizedTitle &&
      (candidate.location ?? "").trim().toLowerCase() === normalizedLocation,
  );
  return existing ? { id: existing.id } : null;
}

async function upsertItineraryTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  fields: TemplateFields,
): Promise<{ id: string } | null> {
  const existing = await findExistingItineraryTemplate(supabase, ownerId, fields.title, fields.location);
  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase
    .from("prep_item_templates")
    .insert({
      owner_id: ownerId,
      title: fields.title,
      item_type: "itinerary_item",
      // Neither concept applies to a reusable itinerary item - both columns
      // are required by the table, so a stable default is sent, mirroring
      // TemplateForm's own hidden fields for this same item_type.
      category: "other",
      classification: "recommended",
      location: fields.location,
      city: fields.city,
      country: fields.country,
      continent: fields.continent,
    })
    .select("id")
    .single();

  if (error) {
    // Lost a race against a concurrent save of the exact same template -
    // the unique index is the source of truth, so reuse whatever the other
    // insert just created instead of failing this save.
    if (error.code === "23505") {
      const raced = await findExistingItineraryTemplate(supabase, ownerId, fields.title, fields.location);
      if (raced) {
        return raced;
      }
    }
    return null;
  }

  return created ? { id: created.id } : null;
}

// R05 (#232): the "fromTemplate" save mode reuses a template the visitor
// picked in ItineraryCatalogModal by id, instead of upsertItineraryTemplate's
// title/location match - the visitor may have edited the pre-filled
// title/address before saving, and this path must still point at the exact
// template they picked rather than creating a new one or silently reusing an
// unrelated match. owner_id + item_type are re-checked server-side (not just
// trusted from the client) the same way findExistingItineraryTemplate scopes
// its own lookup.
async function findOwnedItineraryTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  templateId: string,
): Promise<{ id: string } | null> {
  if (!isValidItineraryId(templateId)) {
    return null;
  }

  const { data } = await supabase
    .from("prep_item_templates")
    .select("id")
    .eq("id", templateId)
    .eq("owner_id", ownerId)
    .eq("item_type", "itinerary_item")
    .maybeSingle();

  return data ? { id: data.id } : null;
}

export async function saveNewItineraryItem(
  _previousState: NewItineraryItemActionState,
  formData: FormData,
): Promise<NewItineraryItemActionState> {
  const t = await getTranslations("itineraryForm");
  const tripId = String(formData.get("tripId") ?? "");
  const mode = String(formData.get("mode") ?? "full");
  const templateOnly = mode === "templateOnly";
  const fromExistingTemplate = mode === "fromTemplate";

  if (!isValidItineraryId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }

  const validation = validateItineraryInput(formData, { requireDate: !templateOnly });
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();

  // CityAutocomplete's `city` hidden field only fills in when a real
  // suggestion was picked (see validation.ts's own city/country fallback
  // comment) - only then does `country` hold an actual country name worth
  // keeping on the template. When nothing was picked, `country` just holds
  // whatever free text the visitor typed (validation.ts already treats it
  // as the city itself in that case), so storing it again as the
  // template's country would be redundant, not a real country.
  const hasCitySelection = Boolean(String(formData.get("city") ?? "").trim());
  const templateCountry = hasCitySelection ? String(formData.get("country") ?? "").trim() || null : null;
  const templateContinent = hasCitySelection ? String(formData.get("continent") ?? "").trim() || null : null;

  if (templateOnly) {
    const template = await upsertItineraryTemplate(supabase, user.id, {
      title: validation.data.title,
      location: validation.data.location,
      city: validation.data.city,
      country: templateCountry,
      continent: templateContinent,
    });

    if (!template) {
      return { message: t("actionErrors.templateSaveFailed") };
    }

    revalidatePath("/organizer");
    return { success: true };
  }

  const dateError = await validateDateWithinTrip(supabase, tripId, validation.data.date);
  if (dateError === "identifyTrip") {
    return { message: t("actionErrors.identifyTrip") };
  }
  if (dateError === "dateOutsideTripRange") {
    return { errors: { date: t("actionErrors.dateOutsideTripRange") } };
  }

  const template = fromExistingTemplate
    ? await findOwnedItineraryTemplate(supabase, user.id, String(formData.get("templateId") ?? ""))
    : await upsertItineraryTemplate(supabase, user.id, {
        title: validation.data.title,
        location: validation.data.location,
        city: validation.data.city,
        country: templateCountry,
        continent: templateContinent,
      });

  if (!template) {
    return { message: t(fromExistingTemplate ? "actionErrors.templateNotFound" : "actionErrors.templateSaveFailed") };
  }

  const { data: created, error } = await supabase
    .from("itinerary_items")
    .insert({
      trip_id: tripId,
      item_date: validation.data.date,
      start_time: validation.data.time,
      end_time: validation.data.endTime,
      title: validation.data.title,
      location: validation.data.location,
      notes: validation.data.notes,
      period: validation.data.period,
      city: validation.data.city,
      approx_distance: validation.data.approxDistance,
      template_id: template.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { message: t("actionErrors.addFailed") };
  }

  revalidatePath("/organizer");
  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "itinerary_item",
      entityId: created.id,
      action: "created",
      itemLabel: validation.data.title,
      tab: "itinerary",
    }),
  );
  return { success: true, createdDate: validation.data.date };
}

export type BatchItineraryActionState = {
  message?: string;
  success?: boolean;
  addedCount?: number;
  // Keyed by templateId - R06 (#233) shows each error inline, next to that
  // item's own date input in the batch step, instead of one message that
  // can't say which of several items is the problem.
  itemErrors?: Record<string, string>;
};

const dateShapePattern = /^\d{4}-\d{2}-\d{2}$/;

// R06 (#233): ItineraryCatalogModal's multi-select step (2+ templates
// checked) submits here instead of saveNewItineraryItem's single
// "fromTemplate" path - one row per template + its own per-item date, all
// flagged needs_review = true (D8) so they surface on the itinerary until
// reviewed. Mirrors validateDateWithinTrip's range check per item (one trip
// lookup shared across the whole batch, not one per item) and
// findOwnedItineraryTemplate's ownership check (batched via `.in()` instead
// of one query per template). An item missing a date is silently left out -
// the client already disables "Adicionar" until every item has one (the
// real gate, D8/R06) - while an item with a date outside the trip's range,
// or a template that doesn't resolve to one this user owns, is reported
// per-item in `itemErrors` and left out too, without failing the rest of an
// otherwise-valid batch. No prep_item_templates row is created or modified
// here, only read for ownership + title/location/city (same rule as R05's
// "fromTemplate" path).
export async function addItineraryItemsFromTemplates(
  _previousState: BatchItineraryActionState,
  formData: FormData,
): Promise<BatchItineraryActionState> {
  const t = await getTranslations("itineraryForm");
  const tripId = String(formData.get("tripId") ?? "");

  if (!isValidItineraryId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }

  const templateIds = Array.from(
    new Set(formData.getAll("templateIds").map((value) => String(value))),
  ).filter(isValidItineraryId);

  if (templateIds.length === 0) {
    return { message: t("actionErrors.identifyItem") };
  }

  const { supabase, user } = await authenticatedClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("start_date, end_date")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return { message: t("actionErrors.identifyTrip") };
  }

  const tripEndDate = trip.end_date ?? trip.start_date;

  const { data: ownedTemplates } = await supabase
    .from("prep_item_templates")
    .select("id, title, location, city")
    .eq("owner_id", user.id)
    .eq("item_type", "itinerary_item")
    .in("id", templateIds);
  const ownedById = new Map((ownedTemplates ?? []).map((template) => [template.id, template]));

  const itemErrors: Record<string, string> = {};
  const rows: {
    trip_id: string;
    item_date: string;
    title: string;
    location: string | null;
    city: string | null;
    template_id: string;
    needs_review: boolean;
    created_by: string;
  }[] = [];

  for (const templateId of templateIds) {
    const template = ownedById.get(templateId);
    if (!template) {
      itemErrors[templateId] = t("actionErrors.templateNotFound");
      continue;
    }

    const rawDate = String(formData.get(`date-${templateId}`) ?? "").trim();
    if (!rawDate) {
      continue;
    }
    if (!dateShapePattern.test(rawDate) || Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`))) {
      itemErrors[templateId] = t("errors.dateInvalid");
      continue;
    }
    if (rawDate < trip.start_date || rawDate > tripEndDate) {
      itemErrors[templateId] = t("actionErrors.dateOutsideTripRange");
      continue;
    }

    rows.push({
      trip_id: tripId,
      item_date: rawDate,
      title: template.title,
      location: template.location,
      city: template.city,
      template_id: template.id,
      needs_review: true,
      created_by: user.id,
    });
  }

  if (rows.length === 0) {
    return { message: t("actionErrors.batchAddFailed"), itemErrors };
  }

  const { data: created, error } = await supabase
    .from("itinerary_items")
    .insert(rows)
    .select("id, title");

  if (error) {
    return { message: t("actionErrors.batchAddFailed") };
  }

  revalidatePath("/organizer");
  revalidatePath(`/trips/${tripId}`);
  after(() =>
    Promise.all(
      (created ?? []).map((item) =>
        notifyTripCollaborators({
          supabase,
          tripId,
          actorId: user.id,
          entityType: "itinerary_item",
          entityId: item.id,
          action: "created",
          itemLabel: item.title,
          tab: "itinerary",
        }),
      ),
    ),
  );

  return {
    success: true,
    addedCount: rows.length,
    itemErrors: Object.keys(itemErrors).length ? itemErrors : undefined,
  };
}

export async function createItineraryItem(
  _previousState: ItineraryActionState,
  formData: FormData,
): Promise<ItineraryActionState> {
  const t = await getTranslations("itineraryForm");
  const tripId = String(formData.get("tripId") ?? "");
  const validation = validateItineraryInput(formData);

  if (!isValidItineraryId(tripId)) {
    return { message: t("actionErrors.identifyTrip") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();

  const dateError = await validateDateWithinTrip(supabase, tripId, validation.data.date);
  if (dateError === "identifyTrip") {
    return { message: t("actionErrors.identifyTrip") };
  }
  if (dateError === "dateOutsideTripRange") {
    return { errors: { date: t("actionErrors.dateOutsideTripRange") } };
  }

  const { data: created, error } = await supabase
    .from("itinerary_items")
    .insert({
      trip_id: tripId,
      item_date: validation.data.date,
      start_time: validation.data.time,
      end_time: validation.data.endTime,
      title: validation.data.title,
      location: validation.data.location,
      notes: validation.data.notes,
      period: validation.data.period,
      city: validation.data.city,
      approx_distance: validation.data.approxDistance,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { message: t("actionErrors.addFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "itinerary_item",
      entityId: created.id,
      action: "created",
      itemLabel: validation.data.title,
      tab: "itinerary",
    }),
  );
  return { success: true };
}

export async function updateItineraryItem(
  _previousState: ItineraryActionState,
  formData: FormData,
): Promise<ItineraryActionState> {
  const t = await getTranslations("itineraryForm");
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const validation = validateItineraryInput(formData);

  if (!isValidItineraryId(tripId) || !isValidItineraryId(itemId)) {
    return { message: t("actionErrors.identifyItem") };
  }
  if (!validation.success) {
    return { errors: translateFieldErrors(t, validation.errors) };
  }

  const { supabase, user } = await authenticatedClient();

  const dateError = await validateDateWithinTrip(supabase, tripId, validation.data.date);
  if (dateError === "identifyTrip") {
    return { message: t("actionErrors.identifyTrip") };
  }
  if (dateError === "dateOutsideTripRange") {
    return { errors: { date: t("actionErrors.dateOutsideTripRange") } };
  }

  const { error } = await supabase
    .from("itinerary_items")
    .update({
      item_date: validation.data.date,
      start_time: validation.data.time,
      end_time: validation.data.endTime,
      title: validation.data.title,
      location: validation.data.location,
      notes: validation.data.notes,
      period: validation.data.period,
      city: validation.data.city,
      approx_distance: validation.data.approxDistance,
      // D8 (#229/#233): editing an item IS the review, so every successful
      // edit clears needs_review - regardless of whether it was set, so
      // there's no extra branch here for "was it even flagged".
      needs_review: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("trip_id", tripId);

  if (error) {
    return { message: t("actionErrors.updateFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "itinerary_item",
      entityId: itemId,
      action: "updated",
      itemLabel: validation.data.title,
      tab: "itinerary",
    }),
  );
  return { success: true };
}

// D8 (#229/#233): "Marcar como revisado" in the item's ⋯ menu is the same
// needs_review = false transition updateItineraryItem already applies on
// every edit save - this shortcut just skips opening the edit form when the
// visitor doesn't actually want to change anything else about the item.
export async function markItineraryItemReviewed(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  if (!isValidItineraryId(tripId) || !isValidItineraryId(itemId)) {
    return;
  }

  const { supabase } = await authenticatedClient();

  await supabase
    .from("itinerary_items")
    .update({ needs_review: false, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("trip_id", tripId);

  revalidatePath(`/trips/${tripId}`);
}

export async function deleteItineraryItem(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  if (!isValidItineraryId(tripId) || !isValidItineraryId(itemId)) {
    return;
  }

  const { supabase, user } = await authenticatedClient();
  const { data: deleted } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itemId)
    .eq("trip_id", tripId)
    .select("title")
    .maybeSingle();
  revalidatePath(`/trips/${tripId}`);

  if (deleted) {
    after(() =>
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: user.id,
        entityType: "itinerary_item",
        entityId: itemId,
        action: "deleted",
        itemLabel: deleted.title,
        tab: "itinerary",
      }),
    );
  }
}
