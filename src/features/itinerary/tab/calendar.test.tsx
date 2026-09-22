import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "pt",
}));

import { ItineraryCalendar } from "./calendar";

afterEach(cleanup);

describe("ItineraryCalendar", () => {
  // A short trip fully inside a single month keeps the grid small and
  // predictable for these assertions.
  const tripStartDate = "2027-04-10";
  const tripLastDay = "2027-04-15";

  it("marks a day that already passed as visually distinct but still enabled", () => {
    render(
      <ItineraryCalendar
        tripStartDate={tripStartDate}
        tripLastDay={tripLastDay}
        today="2027-04-12"
        activeDate="2027-04-12"
        onSelectDate={vi.fn()}
        datesWithItems={[]}
      />,
    );

    const pastDay = screen.getByRole("button", { name: /10 de abril de 2027/i });
    expect(pastDay.hasAttribute("disabled")).toBe(false);
    expect(pastDay.className).toContain("text-slate-400");

    const futureDay = screen.getByRole("button", { name: /14 de abril de 2027/i });
    expect(futureDay.className).not.toContain("text-slate-400");
  });

  it("disables days outside the trip's date range", () => {
    render(
      <ItineraryCalendar
        tripStartDate={tripStartDate}
        tripLastDay={tripLastDay}
        today="2027-04-12"
        activeDate="2027-04-12"
        onSelectDate={vi.fn()}
        datesWithItems={[]}
      />,
    );

    const outOfRangeDay = screen.getByRole("button", { name: /, 9 de abril de 2027/i });
    expect(outOfRangeDay.hasAttribute("disabled")).toBe(true);
  });

  it("marks the active day with aria-current", () => {
    render(
      <ItineraryCalendar
        tripStartDate={tripStartDate}
        tripLastDay={tripLastDay}
        today="2027-04-12"
        activeDate="2027-04-12"
        onSelectDate={vi.fn()}
        datesWithItems={[]}
      />,
    );

    expect(screen.getByRole("button", { name: /12 de abril de 2027/i }).getAttribute("aria-current")).toBe("date");
    expect(screen.getByRole("button", { name: /13 de abril de 2027/i }).getAttribute("aria-current")).toBeNull();
  });

  it("calls onSelectDate when a trip day is clicked", () => {
    const onSelectDate = vi.fn();
    render(
      <ItineraryCalendar
        tripStartDate={tripStartDate}
        tripLastDay={tripLastDay}
        today="2027-04-12"
        activeDate="2027-04-12"
        onSelectDate={onSelectDate}
        datesWithItems={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /13 de abril de 2027/i }));

    expect(onSelectDate).toHaveBeenCalledWith("2027-04-13");
  });

  it("shows a marker on days that have at least one itinerary item", () => {
    render(
      <ItineraryCalendar
        tripStartDate={tripStartDate}
        tripLastDay={tripLastDay}
        today="2027-04-12"
        activeDate="2027-04-11"
        onSelectDate={vi.fn()}
        datesWithItems={["2027-04-13"]}
      />,
    );

    const dayWithItem = screen.getByRole("button", { name: /13 de abril de 2027/i });
    expect(dayWithItem.querySelector("span[aria-hidden='true']")).not.toBeNull();

    const dayWithoutItem = screen.getByRole("button", { name: /14 de abril de 2027/i });
    expect(dayWithoutItem.querySelector("span[aria-hidden='true']")).toBeNull();
  });
});
