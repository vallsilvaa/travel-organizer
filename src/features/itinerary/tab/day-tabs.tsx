"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DayTab = {
  date: string;
  label: ReactNode;
  content: ReactNode;
};

type DayTabsProps = {
  days: DayTab[];
  /** Uncontrolled initial day - the only mode page.tsx (a Server Component,
   * so it can't hold client state) can drive today. */
  defaultValue?: string;
  /** Controlled mode, unused for now: a later issue (calendar navigation)
   * needs to drive the selected day from outside this component. */
  value?: string;
  onValueChange?: (value: string) => void;
};

export function DayTabs({ days, defaultValue, value, onValueChange }: DayTabsProps) {
  return (
    <Tabs defaultValue={defaultValue} value={value} onValueChange={onValueChange} className="mt-6">
      <div className="overflow-x-auto pb-1">
        <TabsList className="h-8 w-max">
          {days.map((day) => (
            <TabsTrigger key={day.date} value={day.date}>
              {day.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {days.map((day) => (
        <TabsContent key={day.date} value={day.date} keepMounted className="mt-4">
          {day.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
