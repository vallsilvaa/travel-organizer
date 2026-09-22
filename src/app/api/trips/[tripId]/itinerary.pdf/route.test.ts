import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

vi.mock("next-intl/server", async () => {
  const { createFormatter, createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
    getFormatter: async () => createFormatter(),
  };
});

import { GET } from "./route";

type QueryResult = { data: unknown; error?: unknown };

function queryBuilder(result: QueryResult) {
  const promise = Promise.resolve(result) as Promise<QueryResult> & {
    eq: () => typeof promise;
    order: () => typeof promise;
    select: () => typeof promise;
    single: () => Promise<QueryResult>;
  };
  promise.select = () => promise;
  promise.eq = () => promise;
  promise.order = () => promise;
  promise.single = () => Promise.resolve(result);
  return promise;
}

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const trip = { id: tripId, title: "Viagem à Toscânia", start_date: "2026-09-12", end_date: "2026-09-13" };
const item = {
  id: "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9",
  item_date: "2026-09-12",
  start_time: "14:30:00",
  end_time: "16:00:00",
  title: "Museum visit",
  location: "Belém Tower",
  notes: null,
  period: null,
  city: "Lisbon",
  approx_distance: "2 km",
};

function makeRequest() {
  return new Request(`https://travel.example.com/api/trips/${tripId}/itinerary.pdf`);
}

describe("GET /api/trips/[tripId]/itinerary.pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.from.mockImplementation((table: string) => {
      if (table === "trips") {
        return queryBuilder({ data: trip, error: null });
      }
      if (table === "itinerary_items") {
        return queryBuilder({ data: [item], error: null });
      }
      if (table === "reservations") {
        return queryBuilder({ data: [{ title: "Hotel Lutetia", itinerary_item_id: item.id }], error: null });
      }
      return queryBuilder({ data: null, error: null });
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("returns a downloadable PDF for an authorized participant", async () => {
    const response = await GET(makeRequest(), { params: Promise.resolve({ tripId }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const disposition = response.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("ROTEIRO-Viagem");
    expect(disposition).toContain("filename*=UTF-8''ROTEIRO-Viagem%20%C3%A0%20Tosc%C3%A2nia.pdf");

    const body = await response.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
    // %PDF is the file-format magic number every valid PDF starts with.
    expect(new TextDecoder().decode(body.slice(0, 4))).toBe("%PDF");
  });

  it("returns 401 when the caller is not signed in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET(makeRequest(), { params: Promise.resolve({ tripId }) });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the trip is not found or not accessible (RLS)", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "trips") {
        return queryBuilder({ data: null, error: { message: "not found" } });
      }
      return queryBuilder({ data: null, error: null });
    });

    const response = await GET(makeRequest(), { params: Promise.resolve({ tripId }) });

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed trip id", async () => {
    const response = await GET(makeRequest(), { params: Promise.resolve({ tripId: "not-a-uuid" }) });

    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
