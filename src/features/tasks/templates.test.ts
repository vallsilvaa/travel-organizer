import { describe, expect, it } from "vitest";

import {
  buildEnglandPreparationTasks,
  dateBeforeTrip,
  englandPreparationTemplate,
  isEnglandDestination,
} from "./templates";

describe("England preparation template", () => {
  it("calculates planning dates from the departure date in UTC", () => {
    expect(dateBeforeTrip("2027-03-31", 180)).toBe("2026-10-02");
    expect(dateBeforeTrip("2027-03-31", 1)).toBe("2027-03-30");
  });

  it("builds uniquely keyed assigned tasks", () => {
    const tasks = buildEnglandPreparationTasks("trip-1", "2027-03-31", "user-1");

    expect(tasks).toHaveLength(englandPreparationTemplate.length);
    expect(new Set(tasks.map((task) => task.template_key)).size).toBe(tasks.length);
    expect(tasks.every((task) => task.owner_id === "user-1")).toBe(true);
  });

  it("recognizes common England destinations", () => {
    expect(isEnglandDestination("London, United Kingdom")).toBe(true);
    expect(isEnglandDestination("Oxford and Bath")).toBe(true);
    expect(isEnglandDestination("Tokyo, Japan")).toBe(false);
  });
});
