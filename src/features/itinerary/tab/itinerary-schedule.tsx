"use client";

import { useRef, useState, type ReactNode } from "react";

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
  const [activeDay, setActiveDay] = useState(defaultDay);
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
