import { describe, expect, it } from "vitest";

import { summarizeDestinations, validateTripInput, type DestinationInput } from "./validation";

type DestinationFormInput = {
  label?: string;
  city?: string;
  country?: string;
  continent?: string;
  granularity?: string;
};

function tripForm(values: {
  title?: string;
  destinations?: DestinationFormInput[];
  startDate?: string;
  endDate?: string;
  timezone?: string;
}) {
  const formData = new FormData();
  if (values.title !== undefined) formData.set("title", values.title);
  if (values.startDate !== undefined) formData.set("startDate", values.startDate);
  if (values.endDate !== undefined) formData.set("endDate", values.endDate);
  if (values.timezone !== undefined) formData.set("timezone", values.timezone);
  for (const destination of values.destinations ?? []) {
    formData.append("destinationLabel", destination.label ?? "");
    formData.append("destinationCity", destination.city ?? "");
    formData.append("destinationCountry", destination.country ?? "");
    formData.append("destinationContinent", destination.continent ?? "");
    formData.append("destinationGranularity", destination.granularity ?? "country");
  }
  return formData;
}

const london: DestinationFormInput = {
  label: "London, United Kingdom",
  city: "London",
  country: "United Kingdom",
  continent: "europe",
  granularity: "city",
};

describe("validateTripInput", () => {
  it("accepts a title, one or more destinations, dates, and timezone", () => {
    const result = validateTripInput(
      tripForm({
        title: "Partiu Inglaterra",
        destinations: [london],
        startDate: "2026-10-10",
        endDate: "2026-10-20",
        timezone: "Europe/London",
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data.title).toBe("Partiu Inglaterra");
    expect(result.data.destinations).toEqual([
      { label: "London, United Kingdom", city: "London", country: "United Kingdom", continent: "europe", granularity: "city" },
    ]);
  });

  it("accepts a country-only destination and more than one destination", () => {
    const result = validateTripInput(
      tripForm({
        title: "Europa",
        destinations: [london, { label: "France", country: "France", granularity: "country" }],
        startDate: "2026-10-10",
        endDate: "2026-10-20",
        timezone: "UTC",
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data.destinations).toHaveLength(2);
    expect(result.data.destinations[1]).toEqual({
      label: "France",
      city: null,
      country: "France",
      continent: null,
      granularity: "country",
    });
  });

  it("requires a title and at least one destination", () => {
    const result = validateTripInput(
      tripForm({ title: " ", startDate: "2026-10-10", endDate: "2026-10-20", timezone: "UTC" }),
    );

    expect(result.errors.title).toBe("titleRequired");
    expect(result.errors.destinations).toBe("destinationsRequired");
  });

  it("ignores a destination row left blank (e.g. added then abandoned)", () => {
    const result = validateTripInput(
      tripForm({
        title: "Partiu Inglaterra",
        destinations: [london, { country: "" }],
        startDate: "2026-10-10",
        endDate: "2026-10-20",
        timezone: "UTC",
      }),
    );

    expect(result.data.destinations).toHaveLength(1);
  });

  it("requires a real start date and a real end date", () => {
    const result = validateTripInput(
      tripForm({
        title: "Trip",
        destinations: [london],
        startDate: "2026-02-30",
        timezone: "UTC",
      }),
    );

    expect(result.errors.startDate).toBe("startDateInvalid");
    expect(result.errors.endDate).toBe("endDateRequired");
  });

  it("rejects an end date before the start date", () => {
    const result = validateTripInput(
      tripForm({
        title: "Trip",
        destinations: [london],
        startDate: "2026-10-10",
        endDate: "2026-10-09",
        timezone: "UTC",
      }),
    );

    expect(result.errors.endDate).toBe("endDateBeforeStart");
  });

  it("accepts a past start date by default (editing an existing trip)", () => {
    const result = validateTripInput(
      tripForm({
        title: "Trip",
        destinations: [london],
        startDate: "2020-01-01",
        endDate: "2020-01-05",
        timezone: "UTC",
      }),
    );

    expect(result.errors.startDate).toBeUndefined();
  });

  it("rejects a non-future start date when requireFutureStartDate is set (creation)", () => {
    const result = validateTripInput(
      tripForm({
        title: "Trip",
        destinations: [london],
        startDate: "2020-01-01",
        endDate: "2020-01-05",
        timezone: "UTC",
      }),
      { requireFutureStartDate: true },
    );

    expect(result.errors.startDate).toBe("startDateMustBeFuture");
  });

  it("rejects a missing or invalid timezone", () => {
    const missing = validateTripInput(
      tripForm({ title: "Trip", destinations: [london], startDate: "2026-10-10", endDate: "2026-10-20" }),
    );
    expect(missing.errors.timezone).toBe("timezoneInvalid");

    const invalid = validateTripInput(
      tripForm({
        title: "Trip",
        destinations: [london],
        startDate: "2026-10-10",
        endDate: "2026-10-20",
        timezone: "Mars/Colony",
      }),
    );
    expect(invalid.errors.timezone).toBe("timezoneInvalid");
  });
});

describe("summarizeDestinations", () => {
  it("returns the single destination's label when there is only one", () => {
    const destinations: DestinationInput[] = [
      { label: "London, United Kingdom", city: "London", country: "United Kingdom", continent: "europe", granularity: "city" },
    ];
    expect(summarizeDestinations(destinations)).toBe("London, United Kingdom");
  });

  it("appends a +N suffix for additional destinations", () => {
    const destinations: DestinationInput[] = [
      { label: "London, United Kingdom", city: "London", country: "United Kingdom", continent: "europe", granularity: "city" },
      { label: "France", city: null, country: "France", continent: null, granularity: "country" },
      { label: "Spain", city: null, country: "Spain", continent: null, granularity: "country" },
    ];
    expect(summarizeDestinations(destinations)).toBe("London, United Kingdom +2");
  });

  it("returns an empty string for no destinations", () => {
    expect(summarizeDestinations([])).toBe("");
  });
});
