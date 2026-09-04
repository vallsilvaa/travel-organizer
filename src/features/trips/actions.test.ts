import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  updateEq: vi.fn(),
  deleteEq: vi.fn(),
  updateSelect: vi.fn(),
  deleteSelect: vi.fn(),
  updateMaybeSingle: vi.fn(),
  deleteMaybeSingle: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
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

import { archiveTrip, createTrip, deleteTrip, restoreTrip, updateTrip } from "./actions";

function validTripForm() {
  const formData = new FormData();
  formData.set("destination", "London");
  formData.set("startDate", "2026-10-10");
  formData.set("endDate", "2026-10-18");
  formData.set("timezone", "Europe/London");
  return formData;
}

function editableTripForm() {
  const formData = validTripForm();
  formData.set("tripId", "27823996-ec50-4cc2-8506-a29d07b86f94");
  return formData;
}

describe("createTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.insert.mockResolvedValue({ error: null });
    const updateChain = {
      eq: mocks.updateEq,
      select: mocks.updateSelect,
      maybeSingle: mocks.updateMaybeSingle,
    };
    const deleteChain = {
      eq: mocks.deleteEq,
      select: mocks.deleteSelect,
      maybeSingle: mocks.deleteMaybeSingle,
    };
    mocks.updateEq.mockReturnValue(updateChain);
    mocks.updateSelect.mockReturnValue(updateChain);
    mocks.deleteEq.mockReturnValue(deleteChain);
    mocks.deleteSelect.mockReturnValue(deleteChain);
    mocks.update.mockReturnValue(updateChain);
    mocks.remove.mockReturnValue(deleteChain);
    mocks.updateMaybeSingle.mockResolvedValue({ data: { id: "27823996-ec50-4cc2-8506-a29d07b86f94" }, error: null });
    mocks.deleteMaybeSingle.mockResolvedValue({ data: { id: "27823996-ec50-4cc2-8506-a29d07b86f94" }, error: null });
    mocks.from.mockReturnValue({
      insert: mocks.insert,
      update: mocks.update,
      delete: mocks.remove,
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("creates a trip for the authenticated user and opens it", async () => {
    await expect(createTrip({}, validTripForm())).rejects.toThrow(
      /^NEXT_REDIRECT:\/trips\/[0-9a-f-]{36}$/,
    );

    expect(mocks.from).toHaveBeenCalledWith("trips");
    expect(mocks.from).toHaveBeenCalledWith("trip_tasks");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "London",
        start_date: "2026-10-10",
        end_date: "2026-10-18",
        timezone: "Europe/London",
        created_by: "user-123",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");

    // Creating a trip is how an account becomes an organizer (#150).
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledWith({ is_organizer: true });
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "user-123");
  });

  it("returns validation errors without calling Supabase", async () => {
    const formData = validTripForm();
    formData.set("endDate", "2026-10-09");

    const result = await createTrip({}, formData);

    expect(result.errors?.endDate).toBe(
      "A data de término não pode ser anterior à data de início.",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("createTrip - organizer panel context (#154)", () => {
  function chain(result: { data?: unknown; error?: unknown }) {
    const builder = {
      eq: () => builder,
      in: () => builder,
      select: () => builder,
      single: async () => result,
      maybeSingle: async () => result,
      then: (...args: Parameters<Promise<typeof result>["then"]>) =>
        Promise.resolve(result).then(...args),
    };
    return builder;
  }

  const templateRow = {
    id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
    title: "Check passport validity",
    item_type: "preparation",
    category: "documents",
    continent: "europe",
    country: "Portugal",
    city: "Lisbon",
    classification: "required",
    due_offset_days: 30,
    currency: null,
    estimated_amount: null,
    document_instructions: null,
  };

  function organizerForm() {
    const formData = validTripForm();
    formData.set("organizerContext", "true");
    return formData;
  }

  function makeFrom({
    taskInsertOk = true,
    inviteInsertError = null,
  }: { taskInsertOk?: boolean; inviteInsertError?: unknown } = {}) {
    return vi.fn((table: string) => {
      if (table === "trips") {
        return {
          insert: () => chain({ error: null }),
          select: () => chain({ data: { id: "trip-id", start_date: "2027-01-01", destination: "London" } }),
        };
      }
      if (table === "trip_tasks") {
        return {
          insert: () =>
            taskInsertOk
              ? chain({ data: { id: "new-task-id" }, error: null })
              : chain({ data: null, error: { message: "boom" } }),
        };
      }
      if (table === "profiles") {
        return {
          update: () => chain({ error: null }),
          select: () => chain({ data: { display_name: "Alice" } }),
        };
      }
      if (table === "trip_participants") {
        return { update: () => chain({ error: null }) };
      }
      if (table === "prep_item_templates") {
        return { select: () => chain({ data: [templateRow] }) };
      }
      if (table === "trip_invitations") {
        return { insert: () => chain({ error: inviteInsertError }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123", email: "organizer@example.com" } } });
  });

  it("registers the creator as the trip's organizer, copies selected tasks, and invites a traveler - without redirecting", async () => {
    const from = makeFrom();
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = organizerForm();
    formData.append("taskTemplateIds", templateRow.id);
    formData.set("inviteEmail", "traveler@example.com");

    const result = await createTrip({}, formData);

    expect(from).toHaveBeenCalledWith("trip_participants");
    expect(from).toHaveBeenCalledWith("trip_tasks");
    expect(from).toHaveBeenCalledWith("trip_invitations");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toBe("Viagem criada com sucesso.");
  });

  it("reports a partial failure when a selected task can't be copied into the new trip", async () => {
    const from = makeFrom({ taskInsertOk: false });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    const formData = organizerForm();
    formData.append("taskTemplateIds", templateRow.id);

    const result = await createTrip({}, formData);

    expect(result.success).toBe(true);
    expect(result.message).toContain("pendências");
    expect(result.message).toContain(templateRow.title);
  });

  it("does not touch trip_participants, catalog tasks, or invitations for a plain (non-organizer) creation", async () => {
    const from = makeFrom();
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from });

    await expect(createTrip({}, validTripForm())).rejects.toThrow(/^NEXT_REDIRECT:/);

    expect(from).not.toHaveBeenCalledWith("trip_participants");
    expect(from).not.toHaveBeenCalledWith("trip_invitations");
  });
});

describe("updateTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    const chain = {
      eq: mocks.updateEq,
      select: mocks.updateSelect,
      maybeSingle: mocks.updateMaybeSingle,
    };
    mocks.updateEq.mockReturnValue(chain);
    mocks.updateSelect.mockReturnValue(chain);
    mocks.update.mockReturnValue(chain);
    mocks.updateMaybeSingle.mockResolvedValue({
      data: { id: "27823996-ec50-4cc2-8506-a29d07b86f94" },
      error: null,
    });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("updates destination and dates for the trip creator", async () => {
    const result = await updateTrip({}, editableTripForm());

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      destination: "London",
      start_date: "2026-10-10",
      end_date: "2026-10-18",
      timezone: "Europe/London",
    }));
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "27823996-ec50-4cc2-8506-a29d07b86f94");
    expect(mocks.updateEq).toHaveBeenCalledWith("created_by", "user-123");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/27823996-ec50-4cc2-8506-a29d07b86f94");
    expect(result.success).toBe(true);
  });

  it("rejects an invalid date range before accessing the database", async () => {
    const formData = editableTripForm();
    formData.set("endDate", "2026-10-09");

    const result = await updateTrip({}, formData);

    expect(result.errors?.endDate).toMatch(/não pode ser anterior/i);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("does not report success when authorization denies the update", async () => {
    mocks.updateMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await updateTrip({}, editableTripForm());

    expect(result.success).not.toBe(true);
    expect(result.message).toMatch(/somente quem criou/i);
  });
});

describe("deleteTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    const chain = {
      eq: mocks.deleteEq,
      select: mocks.deleteSelect,
      maybeSingle: mocks.deleteMaybeSingle,
    };
    mocks.deleteEq.mockReturnValue(chain);
    mocks.deleteSelect.mockReturnValue(chain);
    mocks.remove.mockReturnValue(chain);
    mocks.deleteMaybeSingle.mockResolvedValue({
      data: { id: "27823996-ec50-4cc2-8506-a29d07b86f94" },
      error: null,
    });
    mocks.from.mockReturnValue({ delete: mocks.remove });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("deletes the creator's trip and returns to the dashboard", async () => {
    const formData = new FormData();
    formData.set("tripId", "27823996-ec50-4cc2-8506-a29d07b86f94");

    await expect(deleteTrip(formData)).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(mocks.deleteEq).toHaveBeenCalledWith("created_by", "user-123");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("keeps the trip when authorization denies deletion", async () => {
    mocks.deleteMaybeSingle.mockResolvedValue({ data: null, error: null });
    const formData = new FormData();
    formData.set("tripId", "27823996-ec50-4cc2-8506-a29d07b86f94");

    await expect(deleteTrip(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/trips/27823996-ec50-4cc2-8506-a29d07b86f94?tripError=delete_not_allowed",
    );
  });
});

describe("archiveTrip and restoreTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    const chain = {
      eq: mocks.updateEq,
      select: mocks.updateSelect,
      maybeSingle: mocks.updateMaybeSingle,
    };
    mocks.updateEq.mockReturnValue(chain);
    mocks.updateSelect.mockReturnValue(chain);
    mocks.update.mockReturnValue(chain);
    mocks.updateMaybeSingle.mockResolvedValue({
      data: { id: "27823996-ec50-4cc2-8506-a29d07b86f94" },
      error: null,
    });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("archives the creator's trip", async () => {
    const formData = new FormData();
    formData.set("tripId", "27823996-ec50-4cc2-8506-a29d07b86f94");

    await archiveTrip(formData);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived_at: expect.any(String) }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith("created_by", "user-123");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/27823996-ec50-4cc2-8506-a29d07b86f94");
  });

  it("restores an archived trip by clearing archived_at", async () => {
    const formData = new FormData();
    formData.set("tripId", "27823996-ec50-4cc2-8506-a29d07b86f94");

    await restoreTrip(formData);

    expect(mocks.update).toHaveBeenCalledWith({ archived_at: null });
  });

  it("redirects with an error when authorization denies archiving", async () => {
    mocks.updateMaybeSingle.mockResolvedValue({ data: null, error: null });
    const formData = new FormData();
    formData.set("tripId", "27823996-ec50-4cc2-8506-a29d07b86f94");

    await expect(archiveTrip(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/trips/27823996-ec50-4cc2-8506-a29d07b86f94?tripError=archive_not_allowed",
    );
  });
});
