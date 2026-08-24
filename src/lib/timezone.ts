const SUPPORTED_TIME_ZONES = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
})();

export const IANA_TIME_ZONES = SUPPORTED_TIME_ZONES;

export function isSupportedTimeZone(value: string) {
  return SUPPORTED_TIME_ZONES.includes(value);
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
