import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "pt",
}));

import { ItinerarySchedule } from "./itinerary-schedule";

afterEach(cleanup);

const days = [
  { date: "2027-04-10", label: "Dia 1", content: <p>Conteúdo do dia 10</p> },
  { date: "2027-04-11", label: "Dia 2", content: <p>Conteúdo do dia 11</p> },
  { date: "2027-04-12", label: "Dia 3", content: <p>Conteúdo do dia 12</p> },
];

describe("ItinerarySchedule", () => {
  it("clicking a calendar day activates that day's tab", () => {
    render(
      <ItinerarySchedule
        tripStartDate="2027-04-10"
        tripLastDay="2027-04-12"
        today="2027-04-10"
        defaultDay="2027-04-10"
        days={days}
        datesWithItems={[]}
      />,
    );

    expect(screen.getByText("Conteúdo do dia 10").closest("[hidden]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /12 de abril de 2027/i }));

    expect(screen.getByText("Conteúdo do dia 12").closest("[hidden]")).toBeNull();
  });

  it("clicking a day tab keeps the calendar's active day in sync", () => {
    render(
      <ItinerarySchedule
        tripStartDate="2027-04-10"
        tripLastDay="2027-04-12"
        today="2027-04-10"
        defaultDay="2027-04-10"
        days={days}
        datesWithItems={[]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Dia 3" }));

    expect(screen.getByRole("button", { name: /12 de abril de 2027/i }).getAttribute("aria-current")).toBe("date");
  });
});
