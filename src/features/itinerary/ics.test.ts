import { describe, expect, it } from "vitest";

import { buildItineraryIcs } from "./ics";

describe("buildItineraryIcs", () => {
  it("wraps events in a valid VCALENDAR with CRLF line endings", () => {
    const ics = buildItineraryIcs({
      tripDestination: "Lisbon",
      tripTimezone: "Europe/Lisbon",
      tripUrl: "https://travel.example.com/trips/trip-1",
      items: [],
    });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toContain("\n\n");
  });

  it("represents a timed item with a one-hour default duration, in the trip's timezone", () => {
    const ics = buildItineraryIcs({
      tripDestination: "Lisbon",
      tripTimezone: "Europe/Lisbon",
      tripUrl: "https://travel.example.com/trips/trip-1",
      items: [
        {
          id: "item-1",
          item_date: "2026-09-12",
          start_time: "14:30:00",
          title: "Museum visit",
          location: "Belém Tower",
          notes: "Buy tickets online",
        },
      ],
    });

    expect(ics).toContain("DTSTART;TZID=Europe/Lisbon:20260912T143000");
    expect(ics).toContain("DTEND;TZID=Europe/Lisbon:20260912T153000");
    expect(ics).toContain("SUMMARY:Museum visit");
    expect(ics).toContain("LOCATION:Belém Tower");
    expect(ics).toContain("Buy tickets online");
    expect(ics).toContain("URL:https://travel.example.com/trips/trip-1");
  });

  it("rolls a timed event's end into the next day when it starts near midnight", () => {
    const ics = buildItineraryIcs({
      tripDestination: "Lisbon",
      tripTimezone: "Europe/Lisbon",
      tripUrl: "https://travel.example.com/trips/trip-1",
      items: [
        {
          id: "item-2",
          item_date: "2026-09-12",
          start_time: "23:45:00",
          title: "Night flight",
          location: null,
          notes: null,
        },
      ],
    });

    expect(ics).toContain("DTSTART;TZID=Europe/Lisbon:20260912T234500");
    expect(ics).toContain("DTEND;TZID=Europe/Lisbon:20260913T004500");
  });

  it("represents an item without a start time as an all-day event, with no timezone attached", () => {
    const ics = buildItineraryIcs({
      tripDestination: "Lisbon",
      tripTimezone: "Europe/Lisbon",
      tripUrl: "https://travel.example.com/trips/trip-1",
      items: [
        {
          id: "item-3",
          item_date: "2026-09-12",
          start_time: null,
          title: "Explore the city",
          location: null,
          notes: null,
        },
      ],
    });

    expect(ics).toContain("DTSTART;VALUE=DATE:20260912");
    expect(ics).toContain("DTEND;VALUE=DATE:20260913");
    expect(ics).not.toContain("DTSTART:2026");
    expect(ics).not.toContain("TZID");
  });

  it("adds a CATEGORIES line for items tagged with a time-of-day period", () => {
    const ics = buildItineraryIcs({
      tripDestination: "Lisbon",
      tripTimezone: "Europe/Lisbon",
      tripUrl: "https://travel.example.com/trips/trip-1",
      items: [
        {
          id: "item-6",
          item_date: "2026-09-12",
          start_time: null,
          title: "Explore the city",
          location: null,
          notes: null,
          periodLabel: "Morning",
        },
      ],
    });

    expect(ics).toContain("CATEGORIES:Morning");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260912");
  });

  it("does not add a CATEGORIES line when there is no period", () => {
    const ics = buildItineraryIcs({
      tripDestination: "Lisbon",
      tripTimezone: "Europe/Lisbon",
      tripUrl: "https://travel.example.com/trips/trip-1",
      items: [
        {
          id: "item-7",
          item_date: "2026-09-12",
          start_time: null,
          title: "Explore the city",
          location: null,
          notes: null,
        },
      ],
    });

    expect(ics).not.toContain("CATEGORIES");
  });

  it("escapes commas, semicolons, and newlines in free text", () => {
    const ics = buildItineraryIcs({
      tripDestination: "Lisbon",
      tripTimezone: "Europe/Lisbon",
      tripUrl: "https://travel.example.com/trips/trip-1",
      items: [
        {
          id: "item-4",
          item_date: "2026-09-12",
          start_time: null,
          title: "Dinner, drinks; dessert",
          location: null,
          notes: "Line one\nLine two",
        },
      ],
    });

    expect(ics).toContain("SUMMARY:Dinner\\, drinks\\; dessert");
    expect(ics).toContain("Line one\\nLine two");
  });

  it("folds long lines at 75 octets with a leading space continuation", () => {
    const longTitle = "A".repeat(120);
    const ics = buildItineraryIcs({
      tripDestination: "Lisbon",
      tripTimezone: "Europe/Lisbon",
      tripUrl: "https://travel.example.com/trips/trip-1",
      items: [
        {
          id: "item-5",
          item_date: "2026-09-12",
          start_time: null,
          title: longTitle,
          location: null,
          notes: null,
        },
      ],
    });

    const summaryLine = ics.split("\r\n").find((line) => line.startsWith("SUMMARY:"));
    expect(summaryLine?.length).toBeLessThanOrEqual(75);
    expect(ics).toContain(`SUMMARY:${longTitle.slice(0, 66)}\r\n ${longTitle.slice(66)}`);
  });
});
