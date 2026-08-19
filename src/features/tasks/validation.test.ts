import { describe, expect, it } from "vitest";

import { validateTaskInput } from "./validation";

const ownerId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

function validForm() {
  const formData = new FormData();
  formData.set("title", "Book airport transfer");
  formData.set("ownerId", ownerId);
  formData.set("dueDate", "2026-10-10");
  formData.set("category", "transport");
  formData.set("isCritical", "on");
  formData.set("referenceLabel", "Train voucher");
  formData.set("referenceUrl", "https://example.com/train");
  return formData;
}

describe("validateTaskInput", () => {
  it("normalizes a task with an owner and deadline", () => {
    expect(validateTaskInput(validForm())).toEqual({
      success: true,
      data: {
        title: "Book airport transfer",
        ownerId,
        dueDate: "2026-10-10",
        category: "transport",
        isCritical: true,
        referenceLabel: "Train voucher",
        referenceUrl: "https://example.com/train",
      },
    });
  });

  it("allows owner and deadline to be empty", () => {
    const formData = validForm();
    formData.set("ownerId", "");
    formData.set("dueDate", "");
    formData.set("isCritical", "");
    formData.set("referenceLabel", "");
    formData.set("referenceUrl", "");

    expect(validateTaskInput(formData)).toEqual({
      success: true,
      data: {
        title: "Book airport transfer",
        ownerId: null,
        dueDate: null,
        category: "transport",
        isCritical: false,
        referenceLabel: null,
        referenceUrl: null,
      },
    });
  });

  it("rejects an invalid owner and deadline", () => {
    const formData = validForm();
    formData.set("ownerId", "not-a-user");
    formData.set("dueDate", "tomorrow");

    const result = validateTaskInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.owner).toBe("Escolha um responsável válido.");
      expect(result.errors.dueDate).toBe("Informe uma data limite válida.");
    }
  });

  it("rejects unsafe reference URLs and unknown categories", () => {
    const formData = validForm();
    formData.set("category", "visa");
    formData.set("referenceUrl", "javascript:alert(1)");

    const result = validateTaskInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.category).toBe("Escolha uma categoria de preparação válida.");
      expect(result.errors.referenceUrl).toContain("HTTPS");
    }
  });
});
