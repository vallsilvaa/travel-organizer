import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
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

import { createTrip } from "./actions";

function validTripForm() {
  const formData = new FormData();
  formData.set("destination", "London");
  formData.set("startDate", "2026-10-10");
  formData.set("endDate", "2026-10-18");
  return formData;
}

describe("createTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
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
        created_by: "user-123",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
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
