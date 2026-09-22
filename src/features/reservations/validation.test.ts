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
        itineraryItemId: null,
        paidAmount: null,
        currency: null,
        paymentStatus: null,
        responsibleIds: [],
      },
    });
  });

  it("links to an itinerary item when a valid id is given", () => {
    const formData = validForm();
    formData.set("itineraryItemId", "11111111-1111-4111-8111-111111111111");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.itineraryItemId).toBe("11111111-1111-4111-8111-111111111111");
    }
  });

  it("treats the \"none\" sentinel as no itinerary item link", () => {
    const formData = validForm();
    formData.set("itineraryItemId", "none");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.itineraryItemId).toBeNull();
    }
  });

  it("rejects a malformed itinerary item id", () => {
    const formData = validForm();
    formData.set("itineraryItemId", "not-a-uuid");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.itineraryItemId).toBe("itineraryItemInvalid");
    }
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
      expect(result.errors.reservationType).toBe("typeInvalid");
    }
  });

  it("rejects a missing title and invalid start date", () => {
    const formData = validForm();
    formData.set("title", " ");
    formData.set("startDate", "not-a-date");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.title).toBe("titleRequired");
      expect(result.errors.startDate).toBe("startDateInvalid");
    }
  });

  it("rejects an end date before the start date", () => {
    const formData = validForm();
    formData.set("startDate", "2026-10-12");
    formData.set("endDate", "2026-10-10");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.endDate).toBe("endDateBeforeStart");
    }
  });

  it("saves with no cost info even though the paymentStatus radio always submits a value", () => {
    // The form's payment-status control is a radio group, not a select with a
    // blank option - it always has something checked (defaults to "paid"),
    // so a reservation with no amount/currency/responsible people still
    // submits paymentStatus="paid". That alone must not force the amount to
    // become required - the field is labeled optional and has to actually
    // behave that way.
    const formData = validForm();
    formData.set("paymentStatus", "paid");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paidAmount).toBeNull();
      expect(result.data.currency).toBeNull();
      expect(result.data.paymentStatus).toBeNull();
      expect(result.data.responsibleIds).toEqual([]);
    }
  });

  it("normalizes paid amount, currency, payment status, and responsible people together (#171, #205)", () => {
    const formData = validForm();
    formData.set("paidAmount", "199.9");
    formData.set("currency", "usd");
    formData.set("paymentStatus", "paid");
    formData.append("responsibleIds", "11111111-1111-4111-8111-111111111111");
    formData.append("responsibleIds", "22222222-2222-4222-8222-222222222222");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paidAmount).toBe("199.90");
      expect(result.data.currency).toBe("USD");
      expect(result.data.paymentStatus).toBe("paid");
      expect(result.data.responsibleIds).toEqual([
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ]);
    }
  });

  it("accepts a to_pay reservation with no one having paid yet (#205)", () => {
    const formData = validForm();
    formData.set("paidAmount", "100");
    formData.set("currency", "BRL");
    formData.set("paymentStatus", "to_pay");
    formData.append("responsibleIds", "11111111-1111-4111-8111-111111111111");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentStatus).toBe("to_pay");
    }
  });

  it("requires a currency when a paid amount is given", () => {
    const formData = validForm();
    formData.set("paidAmount", "100");
    formData.set("paymentStatus", "paid");
    formData.append("responsibleIds", "11111111-1111-4111-8111-111111111111");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.currency).toBe("currencyRequiredWithPaymentInfo");
    }
  });

  it("requires a payment status when a paid amount is given", () => {
    const formData = validForm();
    formData.set("paidAmount", "100");
    formData.set("currency", "USD");
    formData.append("responsibleIds", "11111111-1111-4111-8111-111111111111");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.paymentStatus).toBe("paymentStatusRequiredWithPaymentInfo");
    }
  });

  it("requires at least one responsible person when a paid amount is given", () => {
    const formData = validForm();
    formData.set("paidAmount", "100");
    formData.set("currency", "USD");
    formData.set("paymentStatus", "paid");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.responsibleIds).toBe("responsibleRequiredWithPaymentInfo");
    }
  });

  it("rejects a malformed responsible person id", () => {
    const formData = validForm();
    formData.set("paidAmount", "100");
    formData.set("currency", "USD");
    formData.set("paymentStatus", "paid");
    formData.append("responsibleIds", "not-a-uuid");

    const result = validateReservationInput(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.responsibleIds).toBe("responsibleInvalid");
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
