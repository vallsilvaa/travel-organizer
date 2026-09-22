"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { localeTag, type Locale } from "@/i18n/locale";
import { addDays } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type MonthKey = { year: number; month: number };

// A trip's day-by-day timeline (grouping.ts) never has a gap: every calendar
// date from tripStartDate to tripLastDay is always a valid, selectable day.
// So "out of range" only ever means before the start or after the end - there
// are no disabled dates *inside* the range to skip over, which keeps arrow-key
// navigation a simple clamp instead of a skip-disabled-cells search.
type ItineraryCalendarProps = {
  tripStartDate: string;
  tripLastDay: string;
  today: string;
  activeDate: string;
  onSelectDate: (date: string) => void;
  datesWithItems: string[];
};

// pt-BR weeks read Monday-first, en-US Sunday-first - both locales this app
// supports (src/i18n/locale.ts) agree with their CLDR default, so a small
// lookup is enough without pulling in Intl.Locale.weekInfo (patchy support).
const FIRST_WEEKDAY_BY_LOCALE: Record<Locale, number> = { pt: 1, en: 0 };

// 2023-01-01 is a Sunday (verified) - used only as a stable anchor to derive
// localized short weekday names in the header row, in first-weekday order.
const WEEKDAY_REFERENCE_SUNDAY = "2023-01-01";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function monthOf(date: string): MonthKey {
  const [year, month] = date.split("-").map(Number);
  return { year, month: month - 1 };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthRank(key: MonthKey) {
  return key.year * 12 + key.month;
}

function normalizeMonth(year: number, month: number): MonthKey {
  if (month < 0) return { year: year - 1, month: 11 };
  if (month > 11) return { year: year + 1, month: 0 };
  return { year, month };
}

function sameMonth(a: MonthKey, b: MonthKey) {
  return a.year === b.year && a.month === b.month;
}

function toUtcDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

/** Every cell for a month grid, `null` for the leading/trailing blanks before
 * day 1 and after the last day - always a multiple of 7 so the grid lines up
 * under the weekday header regardless of the month's length. */
function buildWeeks(year: number, month: number, firstWeekday: number): (string | null)[] {
  const firstOfMonthWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const leading = (firstOfMonthWeekday - firstWeekday + 7) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => ymd(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function ItineraryCalendar({
  tripStartDate,
  tripLastDay,
  today,
  activeDate,
  onSelectDate,
  datesWithItems,
}: ItineraryCalendarProps) {
  const t = useTranslations("itineraryCalendar");
  const locale = useLocale() as Locale;
  const tag = useMemo(() => localeTag(locale), [locale]);
  const firstWeekday = FIRST_WEEKDAY_BY_LOCALE[locale] ?? 0;

  const startBound = useMemo(() => monthOf(tripStartDate), [tripStartDate]);
  const endBound = useMemo(() => monthOf(tripLastDay), [tripLastDay]);

  const [displayed, setDisplayed] = useState<MonthKey>(() => monthOf(activeDate));
  // The active day can also change from outside the calendar (clicking a day
  // tab directly) - keep the visible month following it so the highlighted
  // day is never scrolled off into a month the calendar isn't showing. Adjusted
  // during render (React's documented pattern for "state that tracks a prop")
  // rather than in an effect, which would cost an extra commit for no benefit.
  const [prevActiveDate, setPrevActiveDate] = useState(activeDate);
  if (activeDate !== prevActiveDate) {
    setPrevActiveDate(activeDate);
    const next = monthOf(activeDate);
    if (!sameMonth(displayed, next)) {
      setDisplayed(next);
    }
  }

  // The element to focus after an arrow-key move lives in a ref, not state -
  // it's an instruction for the effect below (an imperative DOM action), and
  // clearing it is bookkeeping the effect owns, not a value the render needs.
  const pendingFocusRef = useRef<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    buttonRefs.current.get(target)?.focus();
    pendingFocusRef.current = null;
  }, [focusTick, displayed]);

  const itemDates = useMemo(() => new Set(datesWithItems), [datesWithItems]);
  const weeks = useMemo(
    () => buildWeeks(displayed.year, displayed.month, firstWeekday),
    [displayed, firstWeekday],
  );

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => formatter.format(toUtcDate(addDays(WEEKDAY_REFERENCE_SUNDAY, firstWeekday + i))));
  }, [tag, firstWeekday]);

  const monthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" });
    const label = formatter.format(new Date(Date.UTC(displayed.year, displayed.month, 1)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [tag, displayed]);

  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    [tag],
  );

  const canGoPrev = monthRank(displayed) > monthRank(startBound);
  const canGoNext = monthRank(displayed) < monthRank(endBound);

  const inRangeDatesOfMonth = weeks.filter(
    (date): date is string => date !== null && date >= tripStartDate && date <= tripLastDay,
  );
  const rovingDate = inRangeDatesOfMonth.includes(activeDate) ? activeDate : (inRangeDatesOfMonth[0] ?? null);

  function goToMonth(next: MonthKey) {
    setDisplayed(next);
  }

  function moveFocus(from: string, deltaOrEdge: number | "home" | "end") {
    let target: string;
    if (deltaOrEdge === "home") {
      target = sameMonth(displayed, startBound) ? tripStartDate : ymd(displayed.year, displayed.month, 1);
    } else if (deltaOrEdge === "end") {
      target = sameMonth(displayed, endBound)
        ? tripLastDay
        : ymd(displayed.year, displayed.month, daysInMonth(displayed.year, displayed.month));
    } else {
      target = addDays(from, deltaOrEdge);
    }
    if (target < tripStartDate) target = tripStartDate;
    if (target > tripLastDay) target = tripLastDay;

    const targetMonth = monthOf(target);
    if (!sameMonth(targetMonth, displayed)) {
      goToMonth(targetMonth);
    }
    pendingFocusRef.current = target;
    setFocusTick((tick) => tick + 1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(date, -1);
        return;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(date, 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(date, -7);
        return;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(date, 7);
        return;
      case "Home":
        event.preventDefault();
        moveFocus(date, "home");
        return;
      case "End":
        event.preventDefault();
        moveFocus(date, "end");
        return;
      default:
        return;
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goToMonth(normalizeMonth(displayed.year, displayed.month - 1))}
          disabled={!canGoPrev}
          aria-label={t("previousMonth")}
          className="flex size-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
        <button
          type="button"
          onClick={() => goToMonth(normalizeMonth(displayed.year, displayed.month + 1))}
          disabled={!canGoNext}
          aria-label={t("nextMonth")}
          className="flex size-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {weekdayLabels.map((label, index) => (
          <span key={index} aria-hidden="true">
            {label}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.map((date, index) => {
          if (!date) {
            return <span key={`blank-${index}`} aria-hidden="true" />;
          }
          const inRange = date >= tripStartDate && date <= tripLastDay;
          const isActive = date === activeDate;
          const isPast = date < today;
          return (
            <button
              key={date}
              ref={(el) => {
                if (el) buttonRefs.current.set(date, el);
                else buttonRefs.current.delete(date);
              }}
              type="button"
              disabled={!inRange}
              tabIndex={date === rovingDate ? 0 : -1}
              aria-current={isActive ? "date" : undefined}
              aria-label={fullDateFormatter.format(toUtcDate(date))}
              onClick={() => onSelectDate(date)}
              onKeyDown={(event) => handleKeyDown(event, date)}
              className={cn(
                "relative flex h-9 w-full items-center justify-center rounded-full text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500",
                "disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent",
                isActive
                  ? "bg-sky-600 font-semibold text-white hover:bg-sky-600"
                  : inRange && "hover:bg-sky-50",
                !isActive && inRange && isPast && "text-slate-400",
              )}
            >
              {Number(date.slice(-2))}
              {itemDates.has(date) && !isActive ? (
                <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-sky-500" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
