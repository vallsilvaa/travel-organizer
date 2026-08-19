export type TripInput = {
  destination: string;
  startDate: string;
  endDate: string | null;
};

export type TripFieldErrors = Partial<Record<keyof TripInput, string>>;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateTripInput(formData: FormData) {
  const destination = String(formData.get("destination") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const rawEndDate = String(formData.get("endDate") ?? "").trim();
  const endDate = rawEndDate || null;
  const errors: TripFieldErrors = {};

  if (!destination) {
    errors.destination = "O destino é obrigatório.";
  } else if (destination.length > 200) {
    errors.destination = "O destino deve ter no máximo 200 caracteres.";
  }

  if (!isIsoDate(startDate)) {
    errors.startDate = "Informe uma data de início válida.";
  }

  if (endDate && !isIsoDate(endDate)) {
    errors.endDate = "Informe uma data de término válida.";
  } else if (endDate && isIsoDate(startDate) && endDate < startDate) {
    errors.endDate = "A data de término não pode ser anterior à data de início.";
  }

  return {
    data: { destination, startDate, endDate } satisfies TripInput,
    errors,
    success: Object.keys(errors).length === 0,
  };
}
