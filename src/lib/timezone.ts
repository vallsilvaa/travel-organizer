const SUPPORTED_TIME_ZONES = (() => {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    // Not guaranteed to be in the enumerated list depending on the ICU/CLDR
    // data version, even though it's always a valid Intl timeZone value -
    // keep it available since it's also the trips table's column default.
    return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    return ["UTC"];
  }
})();

export const IANA_TIME_ZONES = SUPPORTED_TIME_ZONES;

export function isSupportedTimeZone(value: string) {
  // Constructing an Intl.DateTimeFormat isn't a reliable validity check on
  // its own: some engines accept syntactically plausible but non-canonical
  // strings (e.g. "PST") without erroring. List membership is the actual
  // source of truth for "is this a real IANA zone" - "UTC" is special-cased
  // since supportedValuesOf('timeZone') doesn't reliably include it.
  return value === "UTC" || SUPPORTED_TIME_ZONES.includes(value);
}

/** Returns the current date (YYYY-MM-DD) as observed in `timeZone`, so a
 * `date`-only column (trip start/end, task due_date) can be compared against
 * "today" the way the trip's own destination experiences it, rather than the
 * server's UTC clock. */
export function todayInTimeZone(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** `date` (YYYY-MM-DD) shifted forward by `days` whole calendar days, via
 * UTC midnight date-string arithmetic - the same style as daysUntil, for
 * generating a trip's day-by-day itinerary timeline. */
export function addDays(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Whole calendar days from `today` until `targetDate` (both YYYY-MM-DD).
 * Pure date-string arithmetic at UTC midnight, the same pattern already used
 * for ICS export math - timezone-awareness belongs to whoever produced
 * `today` (see todayInTimeZone), not to this function. */
export function daysUntil(targetDate: string, today: string) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / msPerDay,
  );
}
