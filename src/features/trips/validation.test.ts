import { describe, expect, it } from "vitest";

import { validateTripInput } from "./validation";

function tripForm(values: {
  destination?: string;
  startDate?: string;
  endDate?: string;
}) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("validateTripInput", () => {
  it("accepts a destination and start date", () => {
    const result = validateTripInput(
      tripForm({ destination: "London", startDate: "2026-10-10" }),
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      destination: "London",
      startDate: "2026-10-10",
      endDate: null,
    });
  });

  it("requires destination and a real start date", () => {
    const result = validateTripInput(
      tripForm({ destination: " ", startDate: "2026-02-30" }),
    );

    expect(result.errors.destination).toBe("Destination is required.");
    expect(result.errors.startDate).toBe("Enter a valid start date.");
  });

  it("rejects an end date before the start date", () => {
    const result = validateTripInput(
      tripForm({
        destination: "London",
        startDate: "2026-10-10",
        endDate: "2026-10-09",
      }),
    );

    expect(result.errors.endDate).toBe(
      "End date cannot be earlier than start date.",
    );
  });
});
