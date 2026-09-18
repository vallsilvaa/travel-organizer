import { isContinent, type Continent } from "@/features/prep-catalog/shared";
import { isSupportedTimeZone, todayInTimeZone } from "@/lib/timezone";

// A subset of the trip-attachments bucket's allowed_mime_types (see the
// trip_attachments migration) restricted to images, since a cover photo
// isn't a PDF document.
export const allowedCoverImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const maxCoverImageSizeBytes = 10 * 1024 * 1024;

export type CoverImageValidationError = "missing_file" | "file_too_large" | "unsupported_file_type";

export function validateCoverImageUpload(file: File | null): { success: true } | { success: false; error: CoverImageValidationError } {
  if (!file || file.size === 0) {
    return { success: false, error: "missing_file" };
  }
  if (file.size > maxCoverImageSizeBytes) {
    return { success: false, error: "file_too_large" };
  }
  if (!(allowedCoverImageMimeTypes as readonly string[]).includes(file.type)) {
    return { success: false, error: "unsupported_file_type" };
  }

  return { success: true };
}

export type DestinationGranularity = "city" | "country";

export type DestinationInput = {
  label: string;
  city: string | null;
  country: string;
  continent: Continent | null;
  granularity: DestinationGranularity;
};

export type TripInput = {
  title: string;
  destinations: DestinationInput[];
  startDate: string;
  endDate: string;
  timezone: string;
};

export type TripFieldErrors = Partial<Record<keyof TripInput, string>>;

export function isValidTripId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

// A trip's destination(s) are submitted as parallel repeated fields (one
// entry per destination-list-field row, in DOM order) rather than indexed
// names - see DestinationAutocomplete's hidden inputs.
function parseDestinations(formData: FormData): DestinationInput[] {
  const labels = formData.getAll("destinationLabel").map(String);
  const cities = formData.getAll("destinationCity").map(String);
  const countries = formData.getAll("destinationCountry").map(String);
  const continents = formData.getAll("destinationContinent").map(String);
  const granularities = formData.getAll("destinationGranularity").map(String);

  const destinations: DestinationInput[] = [];
  for (let index = 0; index < countries.length; index++) {
    // Sliced to match trip_destinations' own check constraints (200 chars
    // for label/country/city), since the free-text fallback (typed but
    // never selected from the dropdown) has no client-side length cap.
    const country = (countries[index] ?? "").trim().slice(0, 200);
    if (!country) {
      continue;
    }
    const granularity: DestinationGranularity = granularities[index] === "city" ? "city" : "country";
    const city = granularity === "city" ? (cities[index] ?? "").trim().slice(0, 200) || null : null;
    const continentRaw = (continents[index] ?? "").trim();
    const continent = isContinent(continentRaw) ? continentRaw : null;
    const label = ((labels[index] ?? "").trim() || (city ? `${city}, ${country}` : country)).slice(0, 200);
    destinations.push({ label, city, country, continent, granularity });
  }
  return destinations;
}

export type ValidateTripInputOptions = {
  // Only enforced when a trip is first created (see createTrip) - once
  // saved, the creator can freely correct dates even on a trip that has
  // already started.
  requireFutureStartDate?: boolean;
};

export function validateTripInput(formData: FormData, options: ValidateTripInputOptions = {}) {
  const title = String(formData.get("title") ?? "").trim();
  const destinations = parseDestinations(formData);
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const errors: TripFieldErrors = {};

  if (!title) {
    errors.title = "titleRequired";
  } else if (title.length > 200) {
    errors.title = "titleTooLong";
  }

  if (!destinations.length) {
    errors.destinations = "destinationsRequired";
  }

  if (!timezone || !isSupportedTimeZone(timezone)) {
    errors.timezone = "timezoneInvalid";
  }

  if (!isIsoDate(startDate)) {
    errors.startDate = "startDateInvalid";
  } else if (options.requireFutureStartDate && startDate <= todayInTimeZone(timezone || "UTC")) {
    errors.startDate = "startDateMustBeFuture";
  }

  if (!endDate) {
    errors.endDate = "endDateRequired";
  } else if (!isIsoDate(endDate)) {
    errors.endDate = "endDateInvalid";
  } else if (isIsoDate(startDate) && endDate < startDate) {
    errors.endDate = "endDateBeforeStart";
  }

  return {
    data: { title, destinations, startDate, endDate, timezone } satisfies TripInput,
    errors,
    success: Object.keys(errors).length === 0,
  };
}

// The legacy trips.destination free-text column is kept as an
// automatically-derived summary of the structured destinations, so every
// existing reader of trip.destination (invitation emails, page titles,
// cover alt text, delete confirmations, dashboard cards, ...) keeps working
// unchanged.
export function summarizeDestinations(destinations: DestinationInput[]): string {
  if (!destinations.length) {
    return "";
  }
  const [first, ...rest] = destinations;
  const summary = rest.length ? `${first.label} +${rest.length}` : first.label;
  // Guards trips.destination's 200-char check constraint even if a single
  // destination's label is already close to that limit.
  return summary.slice(0, 200);
}
