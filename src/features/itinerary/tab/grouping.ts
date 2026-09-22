import { addDays } from "@/lib/timezone";
import { itineraryPeriods } from "@/features/itinerary/validation";

/** The subset of an itinerary_items row every function below needs. Extra
 * fields (e.g. title, template_id) pass through untouched - each function
 * only reads what its own Pick<...> declares. */
export type ItineraryGroupingItem = {
  item_date: string;
  start_time: string | null;
  period: string | null;
  city: string | null;
  action: string | null;
};

export type ItineraryDayGroup<T> = {
  date: string;
  dayNumber: number;
  items: T[];
};

function itineraryPeriodRank(period: string | null) {
  const index = period ? itineraryPeriods.indexOf(period as (typeof itineraryPeriods)[number]) : -1;
  return index === -1 ? itineraryPeriods.length : index;
}

/** Chronological order: date, then timed items before period-only items,
 * then by time, then by period (morning/afternoon/evening). */
export function sortItineraryItems<T extends Pick<ItineraryGroupingItem, "item_date" | "start_time" | "period">>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.item_date !== b.item_date) {
      return a.item_date < b.item_date ? -1 : 1;
    }
    if (Boolean(a.start_time) !== Boolean(b.start_time)) {
      return a.start_time ? -1 : 1;
    }
    if (a.start_time && b.start_time) {
      return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0;
    }
    return itineraryPeriodRank(a.period) - itineraryPeriodRank(b.period);
  });
}

/** Unique, alphabetically sorted cities among the given items - the city
 * filter's option list. */
export function tripCitiesFromItems<T extends Pick<ItineraryGroupingItem, "city">>(items: T[]): string[] {
  return Array.from(
    new Set(items.map((item) => item.city).filter((city): city is string => Boolean(city))),
  ).sort((a, b) => a.localeCompare(b));
}

export type TripDestinationForFilter = {
  city: string | null;
  granularity: "city" | "country";
};

/** The city filter's option list (R09, D5): cities the trip actually has as
 * a destination, plus - for a country-only destination - cities already
 * used by itinerary items. itinerary_items has no country column to join
 * a country-only destination against (only a free-text `city`, see
 * validation.ts), so this can't attribute an item's city to one specific
 * country-only destination when a trip has more than one; instead, once the
 * trip has *any* country-only destination, any item city not already among
 * the explicit city destinations is treated as belonging to it. A trip made
 * only of city destinations never surfaces an item city outside that list. */
export function tripCitiesForFilter<T extends Pick<ItineraryGroupingItem, "city">>(
  destinations: TripDestinationForFilter[],
  items: T[],
): string[] {
  const cityDestinations = destinations
    .filter((destination): destination is TripDestinationForFilter & { city: string } =>
      destination.granularity === "city" && Boolean(destination.city),
    )
    .map((destination) => destination.city);
  const hasCountryOnlyDestination = destinations.some((destination) => destination.granularity === "country");
  const knownCities = new Set(cityDestinations.map((city) => city.trim().toLowerCase()));

  const itemCitiesFromCountryDestinations = hasCountryOnlyDestination
    ? items
        .map((item) => item.city)
        .filter((city): city is string => city !== null && !knownCities.has(city.trim().toLowerCase()))
    : [];

  return Array.from(new Set([...cityDestinations, ...itemCitiesFromCountryDestinations])).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function filterItineraryItems<T extends Pick<ItineraryGroupingItem, "city" | "period">>(
  items: T[],
  filters: { city: string; period: string },
): T[] {
  return items.filter((item) => {
    const matchesCity = filters.city === "all" || item.city === filters.city;
    const matchesPeriod = filters.period === "all" || item.period === filters.period;
    return matchesCity && matchesPeriod;
  });
}

/** One entry per calendar day from `startDate` to `lastDay` (inclusive),
 * numbered from 1, each carrying the items that fall on that date. Trips
 * without an end_date only have a single valid day - callers resolve that
 * fallback (`trip.end_date ?? trip.start_date`) before calling this. */
export function groupItineraryItemsByDay<T extends Pick<ItineraryGroupingItem, "item_date">>(
  items: T[],
  startDate: string,
  lastDay: string,
): ItineraryDayGroup<T>[] {
  const itemsByDate = new Map<string, T[]>();
  for (const item of items) {
    const list = itemsByDate.get(item.item_date) ?? [];
    list.push(item);
    itemsByDate.set(item.item_date, list);
  }
  const groups: ItineraryDayGroup<T>[] = [];
  let dayNumber = 1;
  for (let cursor = startDate; cursor <= lastDay; cursor = addDays(cursor, 1)) {
    groups.push({ date: cursor, dayNumber, items: itemsByDate.get(cursor) ?? [] });
    dayNumber += 1;
  }
  return groups;
}

/** The first day that actually has something planned, so the day-tab
 * navigation doesn't default to a blank Day 1. Falls back to the first day
 * of the trip when every day is empty. */
export function defaultItineraryDay<T>(groups: ItineraryDayGroup<T>[]): string | undefined {
  return groups.find((group) => group.items.length)?.date ?? groups[0]?.date;
}

/** Items whose date falls outside [startDate, lastDay] - surfaced separately
 * rather than silently dropped when a trip's dates shrink or move after
 * items already exist (#171). */
export function outOfRangeItineraryItems<T extends Pick<ItineraryGroupingItem, "item_date">>(
  items: T[],
  startDate: string,
  lastDay: string,
): T[] {
  return items.filter((item) => item.item_date < startDate || item.item_date > lastDay);
}

/** Check-in/Check-out are always offered as suggestions even before the trip
 * has any itinerary action set, plus anything already typed on this trip's
 * items (#222). */
export function buildTripActions<T extends Pick<ItineraryGroupingItem, "action">>(
  items: T[],
  presetActions: string[],
): string[] {
  return Array.from(
    new Set([
      ...presetActions,
      ...items.map((item) => item.action).filter((action): action is string => Boolean(action)),
    ]),
  );
}
