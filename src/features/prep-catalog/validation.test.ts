import { describe, expect, it } from "vitest";

import { validateTemplateInput } from "./validation";

function validForm() {
  const formData = new FormData();
  formData.set("title", "Check passport validity");
  formData.set("itemType", "preparation");
  formData.set("category", "documents");
  formData.set("continent", "europe");
  formData.set("country", "Portugal");
  formData.set("city", "Lisbon");
  formData.set("classification", "required");
  formData.set("dueOffsetDays", "180");
  formData.set("currency", "eur");
  formData.set("estimatedAmount", "0");
  return formData;
}

describe("validateTemplateInput", () => {
  it("normalizes a valid preparation template", () => {
    expect(validateTemplateInput(validForm())).toEqual({
      success: true,
      data: {
        title: "Check passport validity",
        itemType: "preparation",
        category: "documents",
        continent: "europe",
        country: "Portugal",
        city: "Lisbon",
        classification: "required",
        dueOffsetDays: 180,
        currency: "EUR",
        estimatedAmount: "0.00",
        documentInstructions: null,
      },
    });
  });

  it("allows city, currency and estimated amount to be empty", () => {
    const formData = validForm();
    formData.set("city", "");
    formData.set("currency", "");
    formData.set("estimatedAmount", "");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.city).toBeNull();
      expect(result.data.currency).toBeNull();
      expect(result.data.estimatedAmount).toBeNull();
    }
  });

  it("requires document instructions for a document_request template", () => {
    const formData = validForm();
    formData.set("itemType", "document_request");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.documentInstructions).toBe("documentInstructionsRequired");
    }
  });

  it("accepts a document_request template with instructions", () => {
    const formData = validForm();
    formData.set("itemType", "document_request");
    formData.set("documentInstructions", "Upload a scan of your visa page.");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentInstructions).toBe("Upload a scan of your visa page.");
    }
  });

  it("rejects an invalid continent, classification and out-of-range offset", () => {
    const formData = validForm();
    formData.set("continent", "narnia");
    formData.set("classification", "urgent");
    formData.set("dueOffsetDays", "5000");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.continent).toBe("continentInvalid");
      expect(result.errors.classification).toBe("classificationInvalid");
      expect(result.errors.dueOffsetDays).toBe("dueOffsetDaysInvalid");
    }
  });

  it("rejects a missing country and a negative estimated amount", () => {
    const formData = validForm();
    formData.set("country", "");
    formData.set("estimatedAmount", "-5");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.country).toBe("countryRequired");
      expect(result.errors.estimatedAmount).toBe("estimatedAmountInvalid");
    }
  });

  it("requires a lead time for a preparation template", () => {
    const formData = validForm();
    formData.set("dueOffsetDays", "");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.dueOffsetDays).toBe("dueOffsetDaysInvalid");
    }
  });

  it("rejects a lead time outside the fixed set, even within the old 0-730 range", () => {
    const formData = validForm();
    formData.set("dueOffsetDays", "45");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.dueOffsetDays).toBe("dueOffsetDaysInvalid");
    }
  });

  it("accepts a véspera (1 day before) lead time", () => {
    const formData = validForm();
    formData.set("dueOffsetDays", "1");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueOffsetDays).toBe(1);
    }
  });

  it("does not require a lead time or a continent for an itinerary_item template", () => {
    const formData = validForm();
    formData.set("itemType", "itinerary_item");
    formData.delete("dueOffsetDays");
    formData.delete("continent");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueOffsetDays).toBeNull();
      expect(result.data.continent).toBeNull();
    }
  });

  it("does not require a lead time for a document_request template", () => {
    const formData = validForm();
    formData.set("itemType", "document_request");
    formData.set("documentInstructions", "Upload a scan of your visa page.");
    formData.delete("dueOffsetDays");

    const result = validateTemplateInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueOffsetDays).toBeNull();
    }
  });
});
