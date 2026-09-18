import { describe, expect, it } from "vitest";

import { tripStatus } from "./trip-status";

describe("tripStatus", () => {
  it("is upcoming before the start date", () => {
    expect(
      tripStatus({ start_date: "2099-01-10", end_date: "2099-01-20", archived_at: null, timezone: "UTC" }),
    ).toBe("upcoming");
  });

  it("is active between start and end date (inclusive)", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(
      tripStatus({ start_date: today, end_date: today, archived_at: null, timezone: "UTC" }),
    ).toBe("active");
  });

  it("is completed after the end date", () => {
    expect(
      tripStatus({ start_date: "2000-01-10", end_date: "2000-01-20", archived_at: null, timezone: "UTC" }),
    ).toBe("completed");
  });

  it("falls back to the start date as a single-day trip when there is no end date", () => {
    expect(
      tripStatus({ start_date: "2000-01-10", end_date: null, archived_at: null, timezone: "UTC" }),
    ).toBe("completed");
  });

  it("is archived regardless of dates", () => {
    expect(
      tripStatus({
        start_date: "2099-01-10",
        end_date: "2099-01-20",
        archived_at: "2026-01-01T00:00:00Z",
        timezone: "UTC",
      }),
    ).toBe("archived");
  });
});
