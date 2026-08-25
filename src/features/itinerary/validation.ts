const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ItineraryFieldErrors = Partial<
  Record<"date" | "time" | "title" | "location" | "notes", string>
>;

export type ItineraryInput = {
  date: string;
  time: string | null;
  title: string;
  location: string | null;
  notes: string | null;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function isValidItineraryId(value: string) {
  return uuidPattern.test(value);
}

export function validateItineraryInput(formData: FormData):
  | { success: true; data: ItineraryInput }
  | { success: false; errors: ItineraryFieldErrors } {
  const date = String(formData.get("date") ?? "").trim();
  const time = optionalValue(formData.get("time"));
  const title = String(formData.get("title") ?? "").trim();
  const location = optionalValue(formData.get("location"));
  const notes = optionalValue(formData.get("notes"));
  const errors: ItineraryFieldErrors = {};

  if (!datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    errors.date = "dateInvalid";
  }
  if (time && !timePattern.test(time)) {
    errors.time = "timeInvalid";
  }
  if (!title || title.length > 200) {
    errors.title = "titleRequired";
  }
  if (location && location.length > 200) {
    errors.location = "locationTooLong";
  }
  if (notes && notes.length > 2000) {
    errors.notes = "notesTooLong";
  }

  return Object.keys(errors).length
    ? { success: false, errors }
    : { success: true, data: { date, time, title, location, notes } };
}
