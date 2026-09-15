import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import { GET } from "./route";

type QueryResult = { data: unknown; error?: unknown };

function queryBuilder(result: QueryResult) {
  const promise = Promise.resolve(result) as Promise<QueryResult> & {
    eq: () => typeof promise;
    select: () => typeof promise;
    single: () => Promise<QueryResult>;
  };
  promise.select = () => promise;
  promise.eq = () => promise;
  promise.single = () => Promise.resolve(result);
  return promise;
}

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const reservationId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";
const trip = { id: tripId, destination: "Lisbon", timezone: "Europe/Lisbon" };
const reservation = {
  id: reservationId,
  reservation_type: "flight",
  title: "LIS to CDG",
  confirmation_code: "ABC123",
  start_date: "2026-09-12",
  start_time: "14:30",
  end_date: null,
  end_time: null,
  location: "LIS",
  destination_location: "CDG",
  notes: null,
};

function makeRequest() {
  return new Request(`https://travel.example.com/api/trips/${tripId}/reservations/${reservationId}/ics`);
}

describe("GET /api/trips/[tripId]/reservations/[reservationId]/ics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.from.mockImplementation((table: string) => {
      if (table === "trips") {
        return queryBuilder({ data: trip, error: null });
      }
      if (table === "trip_reservations") {
        return queryBuilder({ data: reservation, error: null });
      }
      return queryBuilder({ data: null, error: null });
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("returns a downloadable single-event ICS file for an authorized participant", async () => {
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ tripId, reservationId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain(".ics");

    const body = await response.text();
    const unfolded = body.replaceAll("\r\n ", "");
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:LIS to CDG");
    expect(body).toContain("LOCATION:LIS → CDG");
    expect(body).toContain("ABC123");
    expect(unfolded).toContain(`/trips/${tripId}?tab=itinerary#reservation-${reservationId}`);
  });

  it("returns 401 when the caller is not signed in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ tripId, reservationId }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the reservation is not found or not accessible (RLS)", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "trips") {
        return queryBuilder({ data: trip, error: null });
      }
      return queryBuilder({ data: null, error: { message: "not found" } });
    });

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ tripId, reservationId }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const response = await GET(makeRequest(), {
      params: Promise.resolve({ tripId: "not-a-uuid", reservationId }),
    });

    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
