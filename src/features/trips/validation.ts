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
    errors.destination = "Destination is required.";
  } else if (destination.length > 200) {
    errors.destination = "Destination must be 200 characters or fewer.";
  }

  if (!isIsoDate(startDate)) {
    errors.startDate = "Enter a valid start date.";
  }

  if (endDate && !isIsoDate(endDate)) {
    errors.endDate = "Enter a valid end date.";
  } else if (endDate && isIsoDate(startDate) && endDate < startDate) {
    errors.endDate = "End date cannot be earlier than start date.";
  }

  return {
    data: { destination, startDate, endDate } satisfies TripInput,
    errors,
    success: Object.keys(errors).length === 0,
  };
}
