const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const itineraryPeriods = ["morning", "afternoon", "evening"] as const;
export type ItineraryPeriod = (typeof itineraryPeriods)[number];

// Built from a translator scoped to "categories.itineraryPeriod" at each call
// site rather than a hardcoded record - this module has no render-time locale.
export function getItineraryPeriodLabels(t: (period: ItineraryPeriod) => string): Record<ItineraryPeriod, string> {
  return Object.fromEntries(itineraryPeriods.map((period) => [period, t(period)])) as Record<ItineraryPeriod, string>;
}

export function isItineraryPeriod(value: string): value is ItineraryPeriod {
  return (itineraryPeriods as readonly string[]).includes(value);
}

export type ItineraryFieldErrors = Partial<
  Record<
    "date" | "time" | "endTime" | "title" | "location" | "notes" | "period" | "city" | "approxDistance",
    string
  >
>;

export type ItineraryInput = {
  date: string;
  time: string | null;
  endTime: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  period: ItineraryPeriod | null;
  city: string | null;
  approxDistance: string | null;
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
  const endTime = optionalValue(formData.get("endTime"));
  const title = String(formData.get("title") ?? "").trim();
  const location = optionalValue(formData.get("location"));
  const notes = optionalValue(formData.get("notes"));
  // CityAutocomplete only fills its `city` hidden field when a suggestion
  // is actually picked - free text typed without selecting one (e.g. a
  // small town not in the bundled dataset) lands in its `country` field
  // instead (the component's fallback for callers where country is the
  // meaningful field). itinerary_items has no country concept at all, so
  // whichever of the two actually has something is the city the visitor meant.
  const city = optionalValue(formData.get("city")) ?? optionalValue(formData.get("country"));
  const approxDistance = optionalValue(formData.get("approxDistance"));
  const rawPeriodField = optionalValue(formData.get("period"));
  const rawPeriod = rawPeriodField === "none" ? null : rawPeriodField;
  const errors: ItineraryFieldErrors = {};

  if (!datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    errors.date = "dateInvalid";
  }
  if (time && !timePattern.test(time)) {
    errors.time = "timeInvalid";
  }
  // Mirrors the DB check (end_time is null or start_time is not null):
  // an end time only makes sense once there's a start time to end after.
  if (endTime && !timePattern.test(endTime)) {
    errors.endTime = "endTimeInvalid";
  } else if (endTime && !time) {
    errors.endTime = "endTimeRequiresStartTime";
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
  if (city && city.length > 200) {
    errors.city = "cityTooLong";
  }
  if (approxDistance && approxDistance.length > 100) {
    errors.approxDistance = "approxDistanceTooLong";
  }
  if (rawPeriod && !isItineraryPeriod(rawPeriod)) {
    errors.period = "periodInvalid";
  }
  const period = rawPeriod && isItineraryPeriod(rawPeriod) ? rawPeriod : null;

  return Object.keys(errors).length
    ? { success: false, errors }
    : {
        success: true,
        data: { date, time, endTime, title, location, notes, period, city, approxDistance },
      };
}
