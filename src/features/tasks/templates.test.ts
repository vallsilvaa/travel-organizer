import { describe, expect, it } from "vitest";

import { dateBeforeTrip } from "./templates";

describe("dateBeforeTrip", () => {
  it("calculates planning dates from the departure date in UTC", () => {
    expect(dateBeforeTrip("2027-03-31", 180)).toBe("2026-10-02");
    expect(dateBeforeTrip("2027-03-31", 1)).toBe("2027-03-30");
  });
});
