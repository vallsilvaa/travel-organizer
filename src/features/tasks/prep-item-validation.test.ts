import { describe, expect, it } from "vitest";

import { validatePrepItemInput } from "./prep-item-validation";

const assignedTo = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
const itineraryItemId = "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9";

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
  formData.set("estimatedAmount", "100");
  formData.set("paidAmount", "90");
  formData.set("assignedTo", assignedTo);
  formData.set("itineraryItemId", itineraryItemId);
  return formData;
}

describe("validatePrepItemInput", () => {
  it("normalizes a valid governed item", () => {
    expect(validatePrepItemInput(validForm())).toEqual({
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
        estimatedAmount: "100.00",
        paidAmount: "90.00",
        documentInstructions: null,
        assignedTo,
        itineraryItemId,
      },
    });
  });

  it("maps the \"none\" sentinels to null", () => {
    const formData = validForm();
    formData.set("assignedTo", "none");
    formData.set("itineraryItemId", "none");

    const result = validatePrepItemInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignedTo).toBeNull();
      expect(result.data.itineraryItemId).toBeNull();
    }
  });

  it("rejects an invalid assignedTo and itineraryItemId", () => {
    const formData = validForm();
    formData.set("assignedTo", "not-a-uuid");
    formData.set("itineraryItemId", "not-a-uuid");

    const result = validatePrepItemInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.assignedTo).toBe("assignedToInvalid");
      expect(result.errors.itineraryItemId).toBe("itineraryItemInvalid");
    }
  });

  it("rejects a negative paid amount", () => {
    const formData = validForm();
    formData.set("paidAmount", "-1");

    const result = validatePrepItemInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.paidAmount).toBe("paidAmountInvalid");
    }
  });

  it("requires document instructions for a document_request item", () => {
    const formData = validForm();
    formData.set("itemType", "document_request");

    const result = validatePrepItemInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.documentInstructions).toBe("documentInstructionsRequired");
    }
  });
});
