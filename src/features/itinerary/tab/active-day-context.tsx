"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ActiveDayContextValue = {
  activeDay: string;
  setActiveDay: (date: string) => void;
};

const ActiveDayContext = createContext<ActiveDayContextValue | null>(null);

// Bridges the "Novo item de roteiro" modal (rendered in the header) and the
// day-tabs navigation (rendered lower in the tab, inside ItinerarySchedule)
// so saving a new item can switch the visible day to it (#231/R04) -
// itinerary-tab.tsx is a Server Component and can't hold that bit of client
// state itself, so this is the shared client ancestor both sides read from.
export function ActiveDayProvider({ defaultDay, children }: { defaultDay: string; children: ReactNode }) {
  const [activeDay, setActiveDay] = useState(defaultDay);
  return <ActiveDayContext.Provider value={{ activeDay, setActiveDay }}>{children}</ActiveDayContext.Provider>;
}

// Returns null outside a provider instead of throwing - callers (e.g.
// ItinerarySchedule, whose own component test renders it standalone) fall
// back to local state in that case rather than requiring every render tree
// to wire up the provider.
export function useActiveDayContext() {
  return useContext(ActiveDayContext);
}
