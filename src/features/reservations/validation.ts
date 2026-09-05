const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const amountPattern = /^\d{1,12}(?:\.\d{1,2})?$/;
const currencyPattern = /^[A-Z]{3}$/;

export const reservationTypes = ["flight", "lodging", "transport"] as const;
export type ReservationType = (typeof reservationTypes)[number];

// Built from a translator scoped to "categories.reservationType" at each call
// site rather than a hardcoded record - this module has no render-time locale.
export function getReservationTypeLabels(t: (type: ReservationType) => string): Record<ReservationType, string> {
  return Object.fromEntries(reservationTypes.map((type) => [type, t(type)])) as Record<ReservationType, string>;
}

export type ReservationFieldErrors = Partial<
  Record<
    | "reservationType"
    | "title"
    | "provider"
    | "confirmationCode"
    | "startDate"
    | "startTime"
    | "endDate"
    | "endTime"
    | "location"
    | "destinationLocation"
    | "notes"
    | "itineraryItemId"
    | "paidAmount"
    | "currency"
    | "payerId",
    string
  >
>;

export type ReservationInput = {
  reservationType: ReservationType;
  title: string;
  provider: string | null;
  confirmationCode: string | null;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
  destinationLocation: string | null;
  notes: string | null;
  itineraryItemId: string | null;
  paidAmount: string | null;
  currency: string | null;
  payerId: string | null;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function isValidReservationId(value: string) {
  return uuidPattern.test(value);
}

export function isReservationType(value: string): value is ReservationType {
  return (reservationTypes as readonly string[]).includes(value);
}

export function validateReservationInput(formData: FormData):
  | { success: true; data: ReservationInput }
  | { success: false; errors: ReservationFieldErrors } {
  const reservationType = String(formData.get("reservationType") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const provider = optionalValue(formData.get("provider"));
  const confirmationCode = optionalValue(formData.get("confirmationCode"));
  const startDate = String(formData.get("startDate") ?? "").trim();
  const startTime = optionalValue(formData.get("startTime"));
  const endDate = optionalValue(formData.get("endDate"));
  const endTime = optionalValue(formData.get("endTime"));
  const location = optionalValue(formData.get("location"));
  const destinationLocation = optionalValue(formData.get("destinationLocation"));
  const notes = optionalValue(formData.get("notes"));
  const rawItineraryItemId = optionalValue(formData.get("itineraryItemId"));
  const itineraryItemId = rawItineraryItemId === "none" ? null : rawItineraryItemId;
  const rawPaidAmount = optionalValue(formData.get("paidAmount"));
  const currency = optionalValue(formData.get("currency"))?.toUpperCase() ?? null;
  const rawPayerId = optionalValue(formData.get("payerId"));
  const payerId = rawPayerId === "none" ? null : rawPayerId;
  const errors: ReservationFieldErrors = {};

  if (itineraryItemId && !uuidPattern.test(itineraryItemId)) {
    errors.itineraryItemId = "itineraryItemInvalid";
  }

  if (!isReservationType(reservationType)) {
    errors.reservationType = "typeInvalid";
  }
  if (!title || title.length > 200) {
    errors.title = "titleRequired";
  }
  if (provider && provider.length > 200) {
    errors.provider = "providerTooLong";
  }
  if (confirmationCode && confirmationCode.length > 100) {
    errors.confirmationCode = "confirmationCodeTooLong";
  }
  if (!datePattern.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))) {
    errors.startDate = "startDateInvalid";
  }
  if (startTime && !timePattern.test(startTime)) {
    errors.startTime = "startTimeInvalid";
  }
  if (endDate) {
    if (!datePattern.test(endDate) || Number.isNaN(Date.parse(`${endDate}T00:00:00Z`))) {
      errors.endDate = "endDateInvalid";
    } else if (datePattern.test(startDate) && endDate < startDate) {
      errors.endDate = "endDateBeforeStart";
    }
  }
  if (endTime && !timePattern.test(endTime)) {
    errors.endTime = "endTimeInvalid";
  }
  if (location && location.length > 200) {
    errors.location = "locationTooLong";
  }
  if (destinationLocation && destinationLocation.length > 200) {
    errors.destinationLocation = "destinationLocationTooLong";
  }
  if (notes && notes.length > 2000) {
    errors.notes = "notesTooLong";
  }

  // Paid amount, currency, and payer travel together: either all three are
  // present (the reservation has been paid for) or none are (#171) - the
  // same all-or-nothing shape the database constraint enforces.
  let paidAmount: string | null = null;
  if (rawPaidAmount) {
    if (!amountPattern.test(rawPaidAmount) || Number(rawPaidAmount) <= 0) {
      errors.paidAmount = "paidAmountInvalid";
    } else {
      paidAmount = Number(rawPaidAmount).toFixed(2);
    }
  }
  if (currency && !currencyPattern.test(currency)) {
    errors.currency = "currencyInvalid";
  }
  if (payerId && !uuidPattern.test(payerId)) {
    errors.payerId = "payerInvalid";
  }
  if (paidAmount && !currency) {
    errors.currency = "currencyRequiredWithPaidAmount";
  }
  if (paidAmount && !payerId) {
    errors.payerId = "payerRequiredWithPaidAmount";
  }

  return Object.keys(errors).length
    ? { success: false, errors }
    : {
        success: true,
        data: {
          reservationType: reservationType as ReservationType,
          title,
          provider,
          confirmationCode,
          startDate,
          startTime,
          endDate,
          endTime,
          location,
          destinationLocation,
          notes,
          itineraryItemId,
          paidAmount,
          currency: paidAmount ? currency : null,
          payerId: paidAmount ? payerId : null,
        },
      };
}

// Confirmation codes are sensitive: show only the last 4 characters by
// default so a screen share or shoulder-surf does not leak the whole code.
export function maskConfirmationCode(code: string) {
  const trimmed = code.trim();
  if (trimmed.length <= 4) {
    return trimmed;
  }
  return `${"•".repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}
