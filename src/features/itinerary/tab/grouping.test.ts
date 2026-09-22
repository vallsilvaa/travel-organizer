import { describe, expect, it } from "vitest";

import {
  buildTripActions,
  defaultItineraryDay,
  filterItineraryItems,
  groupItineraryItemsByDay,
  outOfRangeItineraryItems,
  sortItineraryItems,
  tripCitiesForFilter,
  tripCitiesFromItems,
  type ItineraryGroupingItem,
  type TripDestinationForFilter,
} from "./grouping";

function item(overrides: Partial<ItineraryGroupingItem> & { id: string }): ItineraryGroupingItem & { id: string } {
  return {
    item_date: "2026-09-01",
    start_time: null,
    period: null,
    city: null,
    action: null,
    ...overrides,
  };
}

describe("sortItineraryItems", () => {
  it("orders by date first", () => {
    const items = [item({ id: "b", item_date: "2026-09-02" }), item({ id: "a", item_date: "2026-09-01" })];

    expect(sortItineraryItems(items).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("puts timed items before period-only items on the same date", () => {
    const items = [
      item({ id: "period-only", period: "morning" }),
      item({ id: "timed", start_time: "09:00" }),
    ];

    expect(sortItineraryItems(items).map((i) => i.id)).toEqual(["timed", "period-only"]);
  });

  it("orders timed items by time", () => {
    const items = [
      item({ id: "late", start_time: "18:30" }),
      item({ id: "early", start_time: "08:00" }),
    ];

    expect(sortItineraryItems(items).map((i) => i.id)).toEqual(["early", "late"]);
  });

  it("orders period-only items morning, afternoon, evening", () => {
    const items = [
      item({ id: "evening", period: "evening" }),
      item({ id: "morning", period: "morning" }),
      item({ id: "afternoon", period: "afternoon" }),
    ];

    expect(sortItineraryItems(items).map((i) => i.id)).toEqual(["morning", "afternoon", "evening"]);
  });

  it("sorts items with no time and no period last among period-only items", () => {
    const items = [
      item({ id: "none" }),
      item({ id: "morning", period: "morning" }),
    ];

    expect(sortItineraryItems(items).map((i) => i.id)).toEqual(["morning", "none"]);
  });

  it("does not mutate the input array", () => {
    const items = [item({ id: "b", item_date: "2026-09-02" }), item({ id: "a", item_date: "2026-09-01" })];
    const original = [...items];

    sortItineraryItems(items);

    expect(items).toEqual(original);
  });
});

describe("tripCitiesFromItems", () => {
  it("returns unique cities sorted alphabetically", () => {
    const items = [
      item({ id: "1", city: "Porto" }),
      item({ id: "2", city: "Lisboa" }),
      item({ id: "3", city: "Porto" }),
      item({ id: "4", city: null }),
    ];

    expect(tripCitiesFromItems(items)).toEqual(["Lisboa", "Porto"]);
  });
});

describe("tripCitiesForFilter", () => {
  function destination(overrides: Partial<TripDestinationForFilter>): TripDestinationForFilter {
    return { city: null, granularity: "city", ...overrides };
  }

  it("lists cities from city destinations, ignoring items entirely", () => {
    const destinations = [destination({ city: "Lisboa" }), destination({ city: "Porto" })];
    const items = [item({ id: "1", city: "Faro" })];

    expect(tripCitiesForFilter(destinations, items)).toEqual(["Lisboa", "Porto"]);
  });

  it("never surfaces an item city that isn't a trip destination when there's no country-only destination", () => {
    const destinations = [destination({ city: "Lisboa" })];
    const items = [item({ id: "1", city: "Faro" })];

    expect(tripCitiesForFilter(destinations, items)).toEqual(["Lisboa"]);
  });

  it("adds item cities not already covered when a country-only destination exists (D5)", () => {
    const destinations = [destination({ city: null, granularity: "country" })];
    const items = [item({ id: "1", city: "Kyoto" }), item({ id: "2", city: "Osaka" }), item({ id: "3", city: null })];

    expect(tripCitiesForFilter(destinations, items)).toEqual(["Kyoto", "Osaka"]);
  });

  it("does not duplicate a city already listed as an explicit destination", () => {
    const destinations = [destination({ city: "Lisboa" }), destination({ city: null, granularity: "country" })];
    const items = [item({ id: "1", city: "lisboa" }), item({ id: "2", city: "Porto" })];

    expect(tripCitiesForFilter(destinations, items)).toEqual(["Lisboa", "Porto"]);
  });

  it("returns an empty list when the trip has no destinations", () => {
    expect(tripCitiesForFilter([], [item({ id: "1", city: "Faro" })])).toEqual([]);
  });
});

describe("filterItineraryItems", () => {
  const items = [
    item({ id: "1", city: "Lisboa", period: "morning" }),
    item({ id: "2", city: "Porto", period: "afternoon" }),
    item({ id: "3", city: "Lisboa", period: "afternoon" }),
  ];

  it("returns everything when both filters are 'all'", () => {
    expect(filterItineraryItems(items, { city: "all", period: "all" }).map((i) => i.id)).toEqual(["1", "2", "3"]);
  });

  it("filters by city", () => {
    expect(filterItineraryItems(items, { city: "Lisboa", period: "all" }).map((i) => i.id)).toEqual(["1", "3"]);
  });

  it("filters by period", () => {
    expect(filterItineraryItems(items, { city: "all", period: "afternoon" }).map((i) => i.id)).toEqual(["2", "3"]);
  });

  it("filters by both city and period", () => {
    expect(filterItineraryItems(items, { city: "Lisboa", period: "afternoon" }).map((i) => i.id)).toEqual(["3"]);
  });
});

describe("groupItineraryItemsByDay", () => {
  it("creates one group per calendar day, numbered from 1", () => {
    const groups = groupItineraryItemsByDay([], "2026-09-01", "2026-09-03");

    expect(groups).toEqual([
      { date: "2026-09-01", dayNumber: 1, items: [] },
      { date: "2026-09-02", dayNumber: 2, items: [] },
      { date: "2026-09-03", dayNumber: 3, items: [] },
    ]);
  });

  it("buckets items into their day", () => {
    const day1 = item({ id: "1", item_date: "2026-09-01" });
    const day2 = item({ id: "2", item_date: "2026-09-02" });
    const groups = groupItineraryItemsByDay([day2, day1], "2026-09-01", "2026-09-02");

    expect(groups[0].items).toEqual([day1]);
    expect(groups[1].items).toEqual([day2]);
  });

  it("produces a single day when start and last day are the same (no end_date)", () => {
    const groups = groupItineraryItemsByDay([], "2026-09-01", "2026-09-01");

    expect(groups).toEqual([{ date: "2026-09-01", dayNumber: 1, items: [] }]);
  });
});

describe("defaultItineraryDay", () => {
  it("returns the first day that has items", () => {
    const groups = groupItineraryItemsByDay(
      [item({ id: "1", item_date: "2026-09-02" })],
      "2026-09-01",
      "2026-09-03",
    );

    expect(defaultItineraryDay(groups)).toBe("2026-09-02");
  });

  it("falls back to the first day when every day is empty", () => {
    const groups = groupItineraryItemsByDay([], "2026-09-01", "2026-09-03");

    expect(defaultItineraryDay(groups)).toBe("2026-09-01");
  });

  it("returns undefined for an empty list of groups", () => {
    expect(defaultItineraryDay([])).toBeUndefined();
  });
});

describe("outOfRangeItineraryItems", () => {
  it("returns items before the trip start or after the trip's last day", () => {
    const before = item({ id: "before", item_date: "2026-08-30" });
    const inside = item({ id: "inside", item_date: "2026-09-02" });
    const after = item({ id: "after", item_date: "2026-09-10" });

    const result = outOfRangeItineraryItems([before, inside, after], "2026-09-01", "2026-09-05");

    expect(result.map((i) => i.id)).toEqual(["before", "after"]);
  });

  it("returns an empty array when every item is within range", () => {
    const inside = item({ id: "inside", item_date: "2026-09-02" });

    expect(outOfRangeItineraryItems([inside], "2026-09-01", "2026-09-05")).toEqual([]);
  });
});

describe("buildTripActions", () => {
  it("always includes the preset actions first", () => {
    expect(buildTripActions([], ["Check-in", "Check-out"])).toEqual(["Check-in", "Check-out"]);
  });

  it("appends distinct actions used on existing items", () => {
    const items = [item({ id: "1", action: "Visitar" }), item({ id: "2", action: "Check-in" })];

    expect(buildTripActions(items, ["Check-in", "Check-out"])).toEqual(["Check-in", "Check-out", "Visitar"]);
  });

  it("ignores items with no action", () => {
    const items = [item({ id: "1", action: null })];

    expect(buildTripActions(items, ["Check-in"])).toEqual(["Check-in"]);
  });
});
