"use client";

import { useRef, useState, type ReactNode } from "react";

import { useActiveDayContext } from "./active-day-context";
import { ItineraryCalendar } from "./calendar";
import { DayTabs } from "./day-tabs";

type ScheduleDay = {
  date: string;
  label: ReactNode;
  content: ReactNode;
};

type ItineraryScheduleProps = {
  tripStartDate: string;
  tripLastDay: string;
  today: string;
  defaultDay: string;
  days: ScheduleDay[];
  datesWithItems: string[];
};

// itinerary-tab.tsx is a Server Component and can't hold the "which day is
// active" state itself, but the calendar (R10) and DayTabs (R01, controlled
// via value/onValueChange for exactly this) both need to share it - so this
// is the client component that lifts it above both.
export function ItinerarySchedule({
  tripStartDate,
  tripLastDay,
  today,
  defaultDay,
  days,
  datesWithItems,
}: ItineraryScheduleProps) {
  // Shared with the "Novo item de roteiro" modal via context when one is
  // wrapped around this tree (itinerary-tab.tsx, #231/R04); falls back to
  // local state so tests (itinerary-schedule.test.tsx) can render this
  // standalone, with no provider.
  const shared = useActiveDayContext();
  const [localActiveDay, setLocalActiveDay] = useState(defaultDay);
  const activeDay = shared?.activeDay ?? localActiveDay;
  const setActiveDay = shared?.setActiveDay ?? setLocalActiveDay;
  const tabsSectionRef = useRef<HTMLDivElement>(null);

  function handleCalendarSelect(date: string) {
    setActiveDay(date);
    // Clicking a day tab trigger doesn't need this - its content is already
    // in view. The calendar can sit far enough above the day's content that
    // clicking a date needs an explicit scroll to actually land on it.
    // jsdom (component tests) doesn't implement scrollIntoView at all, unlike
    // every real browser - optional-chaining the method itself, not just the
    // ref, keeps that a silent no-op there instead of a thrown TypeError.
    tabsSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <ItineraryCalendar
        tripStartDate={tripStartDate}
        tripLastDay={tripLastDay}
        today={today}
        activeDate={activeDay}
        onSelectDate={handleCalendarSelect}
        datesWithItems={datesWithItems}
      />
      <div ref={tabsSectionRef}>
        <DayTabs value={activeDay} onValueChange={setActiveDay} days={days} />
      </div>
    </>
  );
}
