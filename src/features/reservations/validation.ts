const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const reservationTypes = ["flight", "lodging", "transport"] as const;
export type ReservationType = (typeof reservationTypes)[number];

export const reservationTypeLabels: Record<ReservationType, string> = {
  flight: "Voo",
  lodging: "Hospedagem",
  transport: "Transporte",
};

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
    | "notes",
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
  const errors: ReservationFieldErrors = {};

  if (!isReservationType(reservationType)) {
    errors.reservationType = "Selecione um tipo de reserva válido.";
  }
  if (!title || title.length > 200) {
    errors.title = "Informe um título com até 200 caracteres.";
  }
  if (provider && provider.length > 200) {
    errors.provider = "O fornecedor deve ter até 200 caracteres.";
  }
  if (confirmationCode && confirmationCode.length > 100) {
    errors.confirmationCode = "O código de confirmação deve ter até 100 caracteres.";
  }
  if (!datePattern.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))) {
    errors.startDate = "Informe uma data de início válida.";
  }
  if (startTime && !timePattern.test(startTime)) {
    errors.startTime = "Informe um horário de início válido.";
  }
  if (endDate) {
    if (!datePattern.test(endDate) || Number.isNaN(Date.parse(`${endDate}T00:00:00Z`))) {
      errors.endDate = "Informe uma data de término válida.";
    } else if (datePattern.test(startDate) && endDate < startDate) {
      errors.endDate = "A data de término não pode ser anterior à data de início.";
    }
  }
  if (endTime && !timePattern.test(endTime)) {
    errors.endTime = "Informe um horário de término válido.";
  }
  if (location && location.length > 200) {
    errors.location = "O local deve ter até 200 caracteres.";
  }
  if (destinationLocation && destinationLocation.length > 200) {
    errors.destinationLocation = "O destino deve ter até 200 caracteres.";
  }
  if (notes && notes.length > 2000) {
    errors.notes = "As notas devem ter até 2.000 caracteres.";
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
