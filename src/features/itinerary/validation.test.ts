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
      },
    });
  });

  it("allows optional fields to be empty", () => {
    const formData = validForm();
    formData.set("time", "");
    formData.set("location", "");
    formData.set("notes", "");
    formData.set("period", "");

    const result = validateItineraryInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.time).toBeNull();
      expect(result.data.location).toBeNull();
      expect(result.data.notes).toBeNull();
      expect(result.data.period).toBeNull();
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
