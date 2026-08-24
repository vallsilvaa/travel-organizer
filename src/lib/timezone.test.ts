import { describe, expect, it } from "vitest";

import { isSupportedTimeZone, todayInTimeZone } from "./timezone";

describe("timezone", () => {
  it("accepts canonical IANA identifiers", () => {
    expect(isSupportedTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isSupportedTimeZone("UTC")).toBe(true);
  });

  it("rejects values that are not IANA identifiers", () => {
    expect(isSupportedTimeZone("PST")).toBe(false);
    expect(isSupportedTimeZone("not-a-timezone")).toBe(false);
    expect(isSupportedTimeZone("")).toBe(false);
  });

  it("keeps the same calendar date near midnight UTC when the zone is behind", () => {
    // 2026-08-25T02:00:00Z is still 2026-08-24 in Sao Paulo (UTC-3).
    expect(todayInTimeZone("America/Sao_Paulo", new Date("2026-08-25T02:00:00Z"))).toBe(
      "2026-08-24",
    );
  });

  it("rolls over to the next calendar date when the zone is ahead", () => {
    // 2026-08-24T20:00:00Z is already 2026-08-25 in Tokyo (UTC+9).
    expect(todayInTimeZone("Asia/Tokyo", new Date("2026-08-24T20:00:00Z"))).toBe("2026-08-25");
  });
});
