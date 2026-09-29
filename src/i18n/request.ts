import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, localeCookieName } from "./locale";

// No path-based routing (no /pt or /en segment): the locale is a plain
// user preference kept in a cookie, so every existing URL (trip invites,
// ICS export links, auth callbacks) keeps working unchanged.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(localeCookieName)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : defaultLocale;

  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../messages/${locale}.json`)).default,
    formats: {
      dateTime: {
        short: { dateStyle: "short" },
        medium: { dateStyle: "medium" },
        long: { dateStyle: "long" },
        // A standalone format, not an extra option alongside `dateStyle` -
        // ECMA-402 throws if `weekday` is combined with `dateStyle` in the
        // same Intl.DateTimeFormat options.
        weekday: { weekday: "long" },
        // Day/month only, no year - `dateStyle: "short"` above always
        // includes the year, which the itinerary day-tabs' label doesn't
        // want (the trip never spans multiple years in practice, and the
        // full date is already in the day heading right below the tabs).
        dayMonth: { day: "2-digit", month: "2-digit" },
      },
    },
    onError: (error) => {
      // next-intl throws for any message key it can't resolve; the rest of
      // this app treats a broken translation as a bug to fix, not a runtime
      // condition to swallow silently in production.
      if (process.env.NODE_ENV !== "production") {
        throw error;
      }
    },
    getMessageFallback: ({ key }) => key,
  };
});
