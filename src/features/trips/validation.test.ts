import { describe, expect, it } from "vitest";

import { validateTripInput } from "./validation";

function tripForm(values: {
  destination?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
}) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("validateTripInput", () => {
  it("accepts a destination, start date, and timezone", () => {
    const result = validateTripInput(
      tripForm({ destination: "London", startDate: "2026-10-10", timezone: "Europe/London" }),
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      destination: "London",
      startDate: "2026-10-10",
      endDate: null,
      timezone: "Europe/London",
    });
  });

  it("requires destination and a real start date", () => {
    const result = validateTripInput(
      tripForm({ destination: " ", startDate: "2026-02-30", timezone: "UTC" }),
    );

    expect(result.errors.destination).toBe("O destino é obrigatório.");
    expect(result.errors.startDate).toBe("Informe uma data de início válida.");
  });

  it("rejects an end date before the start date", () => {
    const result = validateTripInput(
      tripForm({
        destination: "London",
        startDate: "2026-10-10",
        endDate: "2026-10-09",
        timezone: "UTC",
      }),
    );

    expect(result.errors.endDate).toBe(
      "A data de término não pode ser anterior à data de início.",
    );
  });

  it("rejects a missing or invalid timezone", () => {
    const missing = validateTripInput(
      tripForm({ destination: "London", startDate: "2026-10-10" }),
    );
    expect(missing.errors.timezone).toBe("Selecione um fuso horário válido.");

    const invalid = validateTripInput(
      tripForm({ destination: "London", startDate: "2026-10-10", timezone: "Mars/Colony" }),
    );
    expect(invalid.errors.timezone).toBe("Selecione um fuso horário válido.");
  });
});
