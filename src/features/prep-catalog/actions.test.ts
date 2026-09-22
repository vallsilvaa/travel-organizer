import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
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

import { applyPrepTemplates, createTemplate, deleteTemplate, updateTemplate } from "./actions";

const templateId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const userId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";

function validForm() {
  const formData = new FormData();
  formData.set("title", "Check passport validity");
  formData.set("itemType", "preparation");
  formData.set("category", "documents");
  formData.set("continent", "europe");
  formData.set("country", "Portugal");
  formData.set("city", "Lisbon");
  formData.set("classification", "required");
  formData.set("dueOffsetDays", "180");
  formData.set("currency", "EUR");
  formData.set("estimatedAmount", "50");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } });
});

describe("template CRUD actions", () => {
  it("creates a template owned by the current user", async () => {
    const createdTemplate = {
      id: templateId,
      title: "Check passport validity",
      item_type: "preparation",
      category: "documents",
      continent: "europe",
      country: "Portugal",
      city: "Lisbon",
      classification: "required",
      due_offset_days: 180,
      currency: "EUR",
      estimated_amount: "50.00",
      document_instructions: null,
    };
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: createdTemplate, error: null }),
      }),
    });
    const from = vi.fn().mockReturnValue({ insert });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const result = await createTemplate({}, validForm());

    expect(from).toHaveBeenCalledWith("prep_item_templates");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: userId,
        title: "Check passport validity",
        item_type: "preparation",
        classification: "required",
        due_offset_days: 180,
      }),
    );
    expect(result.success).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("also applies the new template to a trip when a tripId is provided", async () => {
    const createdTemplate = {
      id: templateId,
      title: "Check passport validity",
      item_type: "preparation",
      category: "documents",
      continent: "europe",
      country: "Portugal",
      city: "Lisbon",
      classification: "required",
      due_offset_days: 180,
      currency: "EUR",
      estimated_amount: "50.00",
      document_instructions: null,
    };
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: createdTemplate, error: null }),
      }),
    });

    const trip = { id: tripId, start_date: "2027-09-10" };
    const tripSingle = vi.fn().mockResolvedValue({ data: trip, error: null });
    const tripEq = vi.fn().mockReturnValue({ single: tripSingle });
    const tripSelect = vi.fn().mockReturnValue({ eq: tripEq });

    const taskInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "new-task-id" }, error: null }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === "prep_item_templates") return { insert };
      if (table === "trips") return { select: tripSelect };
      if (table === "trip_tasks") return { insert: taskInsert };
      throw new Error(`unexpected table ${table}`);
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = validForm();
    formData.set("tripId", tripId);

    const result = await createTemplate({}, formData);

    expect(taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: tripId, template_id: templateId, title: "Check passport validity" }),
    );
    expect(result.success).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("only updates a template owned by the current user", async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ update });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = validForm();
    formData.set("templateId", templateId);
    const result = await updateTemplate({}, formData);

    expect(eq1).toHaveBeenCalledWith("id", templateId);
    expect(eq2).toHaveBeenCalledWith("owner_id", userId);
    expect(result.success).toBe(true);
  });

  it("only deletes a template owned by the current user", async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ delete: del });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = new FormData();
    formData.set("templateId", templateId);
    await deleteTemplate(formData);

    expect(eq1).toHaveBeenCalledWith("id", templateId);
    expect(eq2).toHaveBeenCalledWith("owner_id", userId);
  });
});

describe("applyPrepTemplates", () => {
  it("copies the template's fields into a new trip_tasks row with a computed due date", async () => {
    const template = {
      id: templateId,
      title: "Check passport validity",
      item_type: "preparation",
      category: "documents",
      continent: "europe",
      country: "Portugal",
      city: "Lisbon",
      classification: "required",
      due_offset_days: 7,
      currency: "EUR",
      estimated_amount: "50.00",
      document_instructions: null,
    };
    const templatesIn = vi.fn().mockResolvedValue({ data: [template], error: null });
    const templateSelect = vi.fn().mockReturnValue({ in: templatesIn });

    const trip = { id: tripId, start_date: "2027-09-10" };
    const tripSingle = vi.fn().mockResolvedValue({ data: trip, error: null });
    const tripEq = vi.fn().mockReturnValue({ single: tripSingle });
    const tripSelect = vi.fn().mockReturnValue({ eq: tripEq });

    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "new-task-id" }, error: null }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === "prep_item_templates") return { select: templateSelect };
      if (table === "trips") return { select: tripSelect };
      if (table === "trip_tasks") return { insert };
      throw new Error(`unexpected table ${table}`);
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.append("templateIds", templateId);

    const result = await applyPrepTemplates({}, formData);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: tripId,
        title: "Check passport validity",
        classification: "required",
        is_critical: true,
        due_offset_days: 7,
        due_date: "2027-09-03",
        template_id: templateId,
        owner_id: null,
        itinerary_item_id: null,
        created_by: userId,
      }),
    );
    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
  });

  it("applies an itinerary_item template into itinerary_items instead of trip_tasks", async () => {
    const template = {
      id: templateId,
      title: "Visit the Colosseum",
      action: null,
      item_type: "itinerary_item",
      category: "experiences",
      continent: null,
      country: "Italy",
      city: "Rome",
      classification: "recommended",
      due_offset_days: null,
      currency: null,
      estimated_amount: null,
      document_instructions: null,
    };
    const templatesIn = vi.fn().mockResolvedValue({ data: [template], error: null });
    const templateSelect = vi.fn().mockReturnValue({ in: templatesIn });

    const trip = { id: tripId, start_date: "2027-09-10" };
    const tripSingle = vi.fn().mockResolvedValue({ data: trip, error: null });
    const tripEq = vi.fn().mockReturnValue({ single: tripSingle });
    const tripSelect = vi.fn().mockReturnValue({ eq: tripEq });

    const itineraryInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "new-itinerary-item-id" }, error: null }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === "prep_item_templates") return { select: templateSelect };
      if (table === "trips") return { select: tripSelect };
      if (table === "itinerary_items") return { insert: itineraryInsert };
      throw new Error(`unexpected table ${table}`);
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.append("templateIds", templateId);

    const result = await applyPrepTemplates({}, formData);

    expect(itineraryInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: tripId,
        item_date: "2027-09-10",
        title: "Visit the Colosseum",
        city: "Rome",
        template_id: templateId,
        created_by: userId,
      }),
    );
    expect(itineraryInsert.mock.calls[0][0]).not.toHaveProperty("action");
    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
  });

  it("applies every selected template in one call, mixing preparation and itinerary_item types", async () => {
    const prepTemplateId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
    const itineraryTemplateId = "94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const prepTemplate = {
      id: prepTemplateId,
      title: "Check passport validity",
      item_type: "preparation",
      category: "documents",
      continent: "europe",
      country: "Portugal",
      city: "Lisbon",
      classification: "required",
      due_offset_days: 7,
      currency: "EUR",
      estimated_amount: "50.00",
      document_instructions: null,
    };
    const itineraryTemplate = {
      id: itineraryTemplateId,
      title: "Visit the Colosseum",
      action: null,
      item_type: "itinerary_item",
      category: "experiences",
      continent: null,
      country: "Italy",
      city: "Rome",
      classification: "recommended",
      due_offset_days: null,
      currency: null,
      estimated_amount: null,
      document_instructions: null,
    };
    const templatesIn = vi.fn().mockResolvedValue({ data: [prepTemplate, itineraryTemplate], error: null });
    const templateSelect = vi.fn().mockReturnValue({ in: templatesIn });

    const trip = { id: tripId, start_date: "2027-09-10" };
    const tripSingle = vi.fn().mockResolvedValue({ data: trip, error: null });
    const tripEq = vi.fn().mockReturnValue({ single: tripSingle });
    const tripSelect = vi.fn().mockReturnValue({ eq: tripEq });

    const insert = vi.fn().mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: "new-task-id" }, error: null }) }),
    });
    const itineraryInsert = vi.fn().mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: "new-itinerary-item-id" }, error: null }) }),
    });

    const from = vi.fn((table: string) => {
      if (table === "prep_item_templates") return { select: templateSelect };
      if (table === "trips") return { select: tripSelect };
      if (table === "trip_tasks") return { insert };
      if (table === "itinerary_items") return { insert: itineraryInsert };
      throw new Error(`unexpected table ${table}`);
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.append("templateIds", prepTemplateId);
    formData.append("templateIds", itineraryTemplateId);

    const result = await applyPrepTemplates({}, formData);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(itineraryInsert).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(2);
  });

  it("surfaces a friendly message when every selected template is already active on the trip (#171)", async () => {
    const template = {
      id: templateId,
      title: "Check passport validity",
      item_type: "preparation",
      category: "documents",
      continent: "europe",
      country: "Portugal",
      city: "Lisbon",
      classification: "required",
      due_offset_days: 7,
      currency: "EUR",
      estimated_amount: "50.00",
      document_instructions: null,
    };
    const templatesIn = vi.fn().mockResolvedValue({ data: [template], error: null });
    const templateSelect = vi.fn().mockReturnValue({ in: templatesIn });

    const trip = { id: tripId, start_date: "2027-09-10" };
    const tripSingle = vi.fn().mockResolvedValue({ data: trip, error: null });
    const tripEq = vi.fn().mockReturnValue({ single: tripSingle });
    const tripSelect = vi.fn().mockReturnValue({ eq: tripEq });

    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: null, error: { code: "23505" } }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === "prep_item_templates") return { select: templateSelect };
      if (table === "trips") return { select: tripSelect };
      if (table === "trip_tasks") return { insert };
      throw new Error(`unexpected table ${table}`);
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.append("templateIds", templateId);

    const result = await applyPrepTemplates({}, formData);

    expect(result.success).toBeUndefined();
    expect(result.message).toBeTruthy();
  });
});
