import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  update: vi.fn(),
  tripSingle: vi.fn(),
  templateCandidates: vi.fn(),
  templateInsert: vi.fn(),
  templateInsertSingle: vi.fn(),
  templateLookup: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    fn();
  },
}));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import {
  addItineraryItemsFromTemplates,
  createItineraryItem,
  deleteItineraryItem,
  markItineraryItemReviewed,
  saveNewItineraryItem,
  updateItineraryItem,
} from "./actions";

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const itemId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const existingTemplateId = "c2c6cf9e-0d68-4f5a-8f0c-1c4f4c9b1a11";
const secondTemplateId = "d3d7df0e-1e79-5f6b-9f1d-2d5f5dac2b22";

function validForm() {
  const formData = new FormData();
  formData.set("tripId", tripId);
  formData.set("itemId", itemId);
  formData.set("date", "2026-10-12");
  formData.set("time", "09:30");
  formData.set("endTime", "10:30");
  formData.set("title", "Museum visit");
  formData.set("location", "Central Museum");
  formData.set("notes", "Bring the tickets");
  formData.set("period", "morning");
  formData.set("city", "Lisbon");
  formData.set("approxDistance", "2 km");
  return formData;
}

describe("itinerary actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const itemsBuilder = {
      delete: mocks.delete,
      eq: mocks.eq,
      update: mocks.update,
      insert: mocks.insert,
    };
    mocks.delete.mockReturnValue(itemsBuilder);
    mocks.eq.mockReturnValue(itemsBuilder);
    mocks.update.mockReturnValue(itemsBuilder);
    mocks.insert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: itemId }, error: null }),
      }),
    });
    mocks.tripSingle.mockResolvedValue({
      data: { start_date: "2026-10-01", end_date: "2026-10-20" },
      error: null,
    });
    const tripsBuilder = {
      select: () => ({ eq: () => ({ single: mocks.tripSingle }) }),
    };
    // No existing template by default - upsertItineraryTemplate's
    // select-then-insert-or-reuse falls through to the insert branch unless
    // a test overrides mocks.templateCandidates to simulate a dedupe match.
    mocks.templateCandidates.mockResolvedValue({ data: [] });
    mocks.templateInsertSingle.mockResolvedValue({ data: { id: "template-1" }, error: null });
    // Not found by default - findOwnedItineraryTemplate's lookup (mode
    // "fromTemplate") falls through to a null template unless a test
    // overrides mocks.templateLookup to simulate an owned match.
    mocks.templateLookup.mockResolvedValue({ data: null });
    // `.eq()` chains and is itself awaitable (findExistingItineraryTemplate
    // awaits the return of its last `.eq()` directly, with no further call),
    // while `.maybeSingle()` is also chainable off it (findOwnedItineraryTemplate
    // calls it explicitly after its own `.eq()` chain) - one node covers both
    // real-world query shapes used against this table.
    const templatesQueryNode: {
      eq: () => typeof templatesQueryNode;
      in: () => typeof templatesQueryNode;
      maybeSingle: () => Promise<unknown>;
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => void;
    } = {
      eq: () => templatesQueryNode,
      // addItineraryItemsFromTemplates (#233/R06) batches its ownership
      // lookup with `.in("id", templateIds)` instead of the single-id
      // `.maybeSingle()` findOwnedItineraryTemplate uses - same
      // templateCandidates() mock backs both list-shaped queries.
      in: () => templatesQueryNode,
      maybeSingle: () => mocks.templateLookup(),
      then: (resolve, reject) => mocks.templateCandidates().then(resolve, reject),
    };
    const templatesBuilder = {
      select: () => templatesQueryNode,
      insert: (payload: unknown) => {
        mocks.templateInsert(payload);
        return { select: () => ({ single: () => mocks.templateInsertSingle() }) };
      },
    };
    mocks.from.mockImplementation((table: string) =>
      table === "trips" ? tripsBuilder : table === "prep_item_templates" ? templatesBuilder : itemsBuilder,
    );
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("creates an itinerary item for the authenticated participant", async () => {
    const result = await createItineraryItem({}, validForm());

    expect(mocks.from).toHaveBeenCalledWith("itinerary_items");
    expect(mocks.insert).toHaveBeenCalledWith({
      trip_id: tripId,
      item_date: "2026-10-12",
      start_time: "09:30",
      end_time: "10:30",
      title: "Museum visit",
      location: "Central Museum",
      notes: "Bring the tickets",
      period: "morning",
      city: "Lisbon",
      approx_distance: "2 km",
      created_by: "user-123",
    });
    expect(result.success).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("rejects a new item dated outside the trip's date range (#171)", async () => {
    const formData = validForm();
    formData.set("date", "2026-11-01");

    const result = await createItineraryItem({}, formData);

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(result.errors?.date).toBeTruthy();
  });

  it("accepts an item dated on the start_date of a trip with no end_date (#171)", async () => {
    mocks.tripSingle.mockResolvedValue({
      data: { start_date: "2026-10-12", end_date: null },
      error: null,
    });

    const formData = validForm();
    formData.set("date", "2026-10-12");
    const result = await createItineraryItem({}, formData);
    expect(result.success).toBe(true);
  });

  it("rejects an item dated after the start_date of a trip with no end_date (#171)", async () => {
    mocks.tripSingle.mockResolvedValue({
      data: { start_date: "2026-10-12", end_date: null },
      error: null,
    });

    const formData = validForm();
    formData.set("date", "2026-10-13");
    const result = await createItineraryItem({}, formData);
    expect(result.errors?.date).toBeTruthy();
  });

  it("updates only the requested item within its trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    const result = await updateItineraryItem({}, validForm());

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Museum visit",
        item_date: "2026-10-12",
        end_time: "10:30",
        approx_distance: "2 km",
      }),
    );
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", itemId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(result.success).toBe(true);
  });

  it("clears needs_review on every successful edit save (D8/R06)", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValueOnce({ error: null });

    await updateItineraryItem({}, validForm());

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ needs_review: false }));
  });

  it("rejects updating an item to a date outside the trip's date range (#171)", async () => {
    const formData = validForm();
    formData.set("date", "2026-09-30");

    const result = await updateItineraryItem({}, formData);

    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.errors?.date).toBeTruthy();
  });

  it("deletes only the requested item within its trip", async () => {
    mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockReturnValueOnce({
      select: () => ({ maybeSingle: async () => ({ data: { title: "Museum visit" } }) }),
    });

    await deleteItineraryItem(validForm());

    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", itemId);
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  describe("saveNewItineraryItem (#231/R04)", () => {
    function newItemForm(mode: "full" | "templateOnly" = "full") {
      const formData = validForm();
      formData.set("mode", mode);
      formData.set("country", "Portugal");
      formData.set("continent", "europe");
      return formData;
    }

    it("creates the item and upserts a new reusable template, linking template_id (mode=full)", async () => {
      const result = await saveNewItineraryItem({}, newItemForm("full"));

      expect(mocks.from).toHaveBeenCalledWith("prep_item_templates");
      expect(mocks.templateInsert).toHaveBeenCalledWith({
        owner_id: "user-123",
        title: "Museum visit",
        item_type: "itinerary_item",
        category: "other",
        classification: "recommended",
        location: "Central Museum",
        city: "Lisbon",
        country: "Portugal",
        continent: "europe",
      });
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          trip_id: tripId,
          item_date: "2026-10-12",
          title: "Museum visit",
          template_id: "template-1",
        }),
      );
      expect(result.success).toBe(true);
      expect(result.createdDate).toBe("2026-10-12");
    });

    it("reuses an existing template instead of creating a duplicate", async () => {
      mocks.templateCandidates.mockResolvedValue({
        data: [{ id: "existing-template", title: "Museum visit", location: "Central Museum" }],
      });

      const result = await saveNewItineraryItem({}, newItemForm("full"));

      expect(mocks.templateInsert).not.toHaveBeenCalled();
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({ template_id: "existing-template" }),
      );
      expect(result.success).toBe(true);
    });

    it("only omits country/continent from the template when no city was actually picked", async () => {
      const formData = newItemForm("full");
      // Free text typed without picking a suggestion: validation.ts falls
      // back to `country` as the city, so it must not also land in the
      // template's own country column (see actions.ts's comment).
      formData.set("city", "");
      formData.set("country", "Smallville");

      await saveNewItineraryItem({}, formData);

      expect(mocks.templateInsert).toHaveBeenCalledWith(
        expect.objectContaining({ city: "Smallville", country: null, continent: null }),
      );
    });

    it("'Salvar só como modelo' only upserts the template - no itinerary item, date optional", async () => {
      const formData = newItemForm("templateOnly");
      formData.set("date", "");

      const result = await saveNewItineraryItem({}, formData);

      expect(mocks.from).not.toHaveBeenCalledWith("itinerary_items");
      expect(mocks.templateInsert).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.createdDate).toBeUndefined();
    });

    it("rejects 'Salvar só como modelo' with no title, same as a full save", async () => {
      const formData = newItemForm("templateOnly");
      formData.set("date", "");
      formData.set("title", " ");

      const result = await saveNewItineraryItem({}, formData);

      expect(mocks.templateInsert).not.toHaveBeenCalled();
      expect(result.errors?.title).toBeTruthy();
    });

    it("rejects a full save dated outside the trip's date range, before touching the template", async () => {
      const formData = newItemForm("full");
      formData.set("date", "2026-11-01");

      const result = await saveNewItineraryItem({}, formData);

      expect(mocks.templateInsert).not.toHaveBeenCalled();
      expect(mocks.insert).not.toHaveBeenCalled();
      expect(result.errors?.date).toBeTruthy();
    });
  });

  describe("saveNewItineraryItem 'fromTemplate' mode (#232/R05)", () => {
    function fromTemplateForm(templateId: string = existingTemplateId) {
      const formData = validForm();
      formData.set("mode", "fromTemplate");
      formData.set("templateId", templateId);
      return formData;
    }

    it("creates the item with the given template_id, without creating or upserting a template", async () => {
      mocks.templateLookup.mockResolvedValue({ data: { id: existingTemplateId } });

      const result = await saveNewItineraryItem({}, fromTemplateForm());

      expect(mocks.templateInsert).not.toHaveBeenCalled();
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({ trip_id: tripId, template_id: existingTemplateId }),
      );
      expect(result.success).toBe(true);
      expect(result.createdDate).toBe("2026-10-12");
    });

    it("rejects when the template can't be found for this owner (removed, or never owned it)", async () => {
      mocks.templateLookup.mockResolvedValue({ data: null });

      const result = await saveNewItineraryItem({}, fromTemplateForm());

      expect(mocks.insert).not.toHaveBeenCalled();
      expect(result.success).toBeUndefined();
      expect(result.message).toBeTruthy();
    });

    it("still requires a date, unlike 'Salvar só como modelo' (D3/R05 - applying an existing template always needs one)", async () => {
      const formData = fromTemplateForm();
      formData.set("date", "");

      const result = await saveNewItineraryItem({}, formData);

      expect(mocks.insert).not.toHaveBeenCalled();
      expect(result.errors?.date).toBeTruthy();
    });
  });

  describe("markItineraryItemReviewed (#233/R06)", () => {
    it("flips needs_review to false for the requested item within its trip", async () => {
      const formData = new FormData();
      formData.set("tripId", tripId);
      formData.set("itemId", itemId);

      await markItineraryItemReviewed(formData);

      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ needs_review: false }));
      expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", itemId);
      expect(mocks.eq).toHaveBeenNthCalledWith(2, "trip_id", tripId);
      expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
    });

    it("does nothing for an unidentifiable trip or item", async () => {
      const formData = new FormData();
      formData.set("tripId", "not-a-uuid");
      formData.set("itemId", itemId);

      await markItineraryItemReviewed(formData);

      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  describe("addItineraryItemsFromTemplates (#233/R06)", () => {
    function batchForm(entries: { id: string; date?: string }[]) {
      const formData = new FormData();
      formData.set("tripId", tripId);
      for (const entry of entries) {
        formData.append("templateIds", entry.id);
        if (entry.date !== undefined) {
          formData.set(`date-${entry.id}`, entry.date);
        }
      }
      return formData;
    }

    function ownedTemplates() {
      return [
        { id: existingTemplateId, title: "Museum visit", location: "Central Museum", city: "Lisbon" },
        { id: secondTemplateId, title: "City tour", location: "Old Town", city: "Lisbon" },
      ];
    }

    it("creates one item per template with its own date, flagging needs_review and template_id", async () => {
      mocks.templateCandidates.mockResolvedValue({ data: ownedTemplates() });
      mocks.insert.mockReturnValue({
        select: () =>
          Promise.resolve({
            data: [
              { id: "row-1", title: "Museum visit" },
              { id: "row-2", title: "City tour" },
            ],
            error: null,
          }),
      });

      const formData = batchForm([
        { id: existingTemplateId, date: "2026-10-05" },
        { id: secondTemplateId, date: "2026-10-10" },
      ]);

      const result = await addItineraryItemsFromTemplates({}, formData);

      expect(mocks.insert).toHaveBeenCalledWith([
        {
          trip_id: tripId,
          item_date: "2026-10-05",
          title: "Museum visit",
          location: "Central Museum",
          city: "Lisbon",
          template_id: existingTemplateId,
          needs_review: true,
          created_by: "user-123",
        },
        {
          trip_id: tripId,
          item_date: "2026-10-10",
          title: "City tour",
          location: "Old Town",
          city: "Lisbon",
          template_id: secondTemplateId,
          needs_review: true,
          created_by: "user-123",
        },
      ]);
      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(2);
    });

    it("rejects an out-of-range date for just that item, still adding the rest of the batch", async () => {
      mocks.templateCandidates.mockResolvedValue({ data: ownedTemplates() });
      mocks.insert.mockReturnValue({
        select: () => Promise.resolve({ data: [{ id: "row-1", title: "Museum visit" }], error: null }),
      });

      const formData = batchForm([
        { id: existingTemplateId, date: "2026-10-05" },
        { id: secondTemplateId, date: "2026-11-01" },
      ]);

      const result = await addItineraryItemsFromTemplates({}, formData);

      expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({ template_id: existingTemplateId })]);
      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(1);
      expect(result.itemErrors?.[secondTemplateId]).toBeTruthy();
    });

    it("adds nothing and returns a failure message when every date is out of range", async () => {
      mocks.templateCandidates.mockResolvedValue({ data: ownedTemplates() });

      const formData = batchForm([
        { id: existingTemplateId, date: "2026-11-01" },
        { id: secondTemplateId, date: "2026-11-02" },
      ]);

      const result = await addItineraryItemsFromTemplates({}, formData);

      expect(mocks.insert).not.toHaveBeenCalled();
      expect(result.success).toBeUndefined();
      expect(result.message).toBeTruthy();
      expect(Object.keys(result.itemErrors ?? {})).toHaveLength(2);
    });

    it("silently skips an item with no date instead of failing the batch (the client already gates this)", async () => {
      mocks.templateCandidates.mockResolvedValue({ data: ownedTemplates() });
      mocks.insert.mockReturnValue({
        select: () => Promise.resolve({ data: [{ id: "row-1", title: "Museum visit" }], error: null }),
      });

      const formData = batchForm([
        { id: existingTemplateId, date: "2026-10-05" },
        { id: secondTemplateId },
      ]);

      const result = await addItineraryItemsFromTemplates({}, formData);

      expect(result.addedCount).toBe(1);
      expect(result.itemErrors?.[secondTemplateId]).toBeUndefined();
    });

    it("rejects a template that doesn't resolve to one this user owns", async () => {
      mocks.templateCandidates.mockResolvedValue({ data: [] });

      const formData = batchForm([{ id: existingTemplateId, date: "2026-10-05" }]);

      const result = await addItineraryItemsFromTemplates({}, formData);

      expect(mocks.insert).not.toHaveBeenCalled();
      expect(result.itemErrors?.[existingTemplateId]).toBeTruthy();
    });
  });
});
