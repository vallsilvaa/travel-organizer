import { describe, expect, it } from "vitest";

import { validateItineraryInput } from "./validation";

function validForm() {
  const formData = new FormData();
  formData.set("date", "2026-10-12");
  formData.set("time", "09:30");
  formData.set("title", "Museum visit");
  formData.set("location", "Central Museum");
  formData.set("notes", "Bring the tickets");
  formData.set("period", "morning");
  formData.set("city", "Lisbon");
  formData.set("action", "Check-in");
  return formData;
}

describe("validateItineraryInput", () => {
  it("normalizes a complete itinerary item", () => {
    expect(validateItineraryInput(validForm())).toEqual({
      success: true,
      data: {
        date: "2026-10-12",
        time: "09:30",
        title: "Museum visit",
        location: "Central Museum",
        notes: "Bring the tickets",
        period: "morning",
        city: "Lisbon",
        action: "Check-in",
      },
    });
  });

  it("allows optional fields to be empty", () => {
    const formData = validForm();
    formData.set("time", "");
    formData.set("location", "");
    formData.set("notes", "");
    formData.set("period", "");
    formData.set("city", "");
    formData.set("action", "");

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.time).toBeNull();
      expect(result.data.location).toBeNull();
      expect(result.data.notes).toBeNull();
      expect(result.data.period).toBeNull();
      expect(result.data.city).toBeNull();
      expect(result.data.action).toBeNull();
    }
  });

  it("rejects a city name that is too long", () => {
    const formData = validForm();
    formData.set("city", "A".repeat(201));

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.city).toBe("cityTooLong");
    }
  });

  it("rejects an action that is too long", () => {
    const formData = validForm();
    formData.set("action", "A".repeat(51));

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.action).toBe("actionTooLong");
    }
  });

  it("treats the \"none\" sentinel as no period", () => {
    const formData = validForm();
    formData.set("period", "none");

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period).toBeNull();
    }
  });

  it("rejects invalid required values", () => {
    const formData = validForm();
    formData.set("date", "not-a-date");
    formData.set("title", " ");

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.date).toBe("dateInvalid");
      expect(result.errors.title).toBe("titleRequired");
    }
  });

  it("falls back to the autocomplete's country slot when city wasn't picked from a suggestion", () => {
    // CityAutocomplete only fills its `city` hidden field when a suggestion
    // is selected; free text typed without picking one lands in its
    // `country` field instead (there's no country concept on an itinerary
    // item, so whichever slot has something is the intended city).
    const formData = validForm();
    formData.set("city", "");
    formData.set("country", "Smallville");

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.city).toBe("Smallville");
    }
  });

  it("prefers a selected city over a stray country value", () => {
    const formData = validForm();
    formData.set("city", "Lisbon");
    formData.set("country", "Portugal");

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.city).toBe("Lisbon");
    }
  });

  it("rejects an invalid period", () => {
    const formData = validForm();
    formData.set("period", "midnight");

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.period).toBe("periodInvalid");
    }
  });
});
