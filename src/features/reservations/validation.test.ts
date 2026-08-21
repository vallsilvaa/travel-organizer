import { describe, expect, it } from "vitest";

import { maskConfirmationCode, validateReservationInput } from "./validation";

function validForm() {
  const formData = new FormData();
  formData.set("reservationType", "flight");
  formData.set("title", "Outbound flight");
  formData.set("provider", "LATAM");
  formData.set("confirmationCode", "ABC123");
  formData.set("startDate", "2026-10-12");
  formData.set("startTime", "08:00");
  formData.set("endDate", "2026-10-12");
  formData.set("endTime", "18:00");
  formData.set("location", "GRU");
  formData.set("destinationLocation", "LIS");
  formData.set("notes", "Window seat");
  return formData;
}

describe("validateReservationInput", () => {
  it("normalizes a complete reservation", () => {
    expect(validateReservationInput(validForm())).toEqual({
      success: true,
      data: {
        reservationType: "flight",
        title: "Outbound flight",
        provider: "LATAM",
        confirmationCode: "ABC123",
        startDate: "2026-10-12",
        startTime: "08:00",
        endDate: "2026-10-12",
        endTime: "18:00",
        location: "GRU",
        destinationLocation: "LIS",
        notes: "Window seat",
      },
    });
  });

  it("allows optional fields to be empty", () => {
    const formData = validForm();
    formData.set("provider", "");
    formData.set("confirmationCode", "");
    formData.set("startTime", "");
    formData.set("endDate", "");
    formData.set("endTime", "");
    formData.set("location", "");
    formData.set("destinationLocation", "");
    formData.set("notes", "");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBeNull();
      expect(result.data.confirmationCode).toBeNull();
      expect(result.data.startTime).toBeNull();
      expect(result.data.endDate).toBeNull();
      expect(result.data.endTime).toBeNull();
      expect(result.data.location).toBeNull();
      expect(result.data.destinationLocation).toBeNull();
      expect(result.data.notes).toBeNull();
    }
  });

  it("rejects an unsupported reservation type", () => {
    const formData = validForm();
    formData.set("reservationType", "road-trip");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.reservationType).toBe("Selecione um tipo de reserva válido.");
    }
  });

  it("rejects a missing title and invalid start date", () => {
    const formData = validForm();
    formData.set("title", " ");
    formData.set("startDate", "not-a-date");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.title).toBe("Informe um título com até 200 caracteres.");
      expect(result.errors.startDate).toBe("Informe uma data de início válida.");
    }
  });

  it("rejects an end date before the start date", () => {
    const formData = validForm();
    formData.set("startDate", "2026-10-12");
    formData.set("endDate", "2026-10-10");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.endDate).toBe("A data de término não pode ser anterior à data de início.");
    }
  });
});

describe("maskConfirmationCode", () => {
  it("shows only the last 4 characters of a longer code", () => {
    expect(maskConfirmationCode("ABCDEFGH")).toBe("••••EFGH");
  });

  it("leaves a short code unmasked", () => {
    expect(maskConfirmationCode("AB12")).toBe("AB12");
  });
});
