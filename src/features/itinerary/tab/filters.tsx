"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { itineraryPeriods } from "@/features/itinerary/validation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ItineraryFiltersProps = {
  cities: string[];
  cityFilter: string;
  periodFilter: (typeof itineraryPeriods)[number] | "all";
  periodLabels: Record<(typeof itineraryPeriods)[number], string>;
  cityFilterLabel: string;
  cityFilterAllLabel: string;
  periodFilterLabel: string;
  periodFilterAllLabel: string;
  applyFiltersLabel: string;
  clearFiltersLabel: string;
};

export function ItineraryFilters({
  cities,
  cityFilter,
  periodFilter,
  periodLabels,
  cityFilterLabel,
  cityFilterAllLabel,
  periodFilterLabel,
  periodFilterAllLabel,
  applyFiltersLabel,
  clearFiltersLabel,
}: ItineraryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  if (!cities.length) {
    return null;
  }

  const hasActiveFilters = cityFilter !== "all" || periodFilter !== "all";

  // Applying a filter shouldn't need the "Aplicar filtros" button (R09) -
  // every option change pushes the updated query string right away. The
  // button stays as an explicit no-op fallback for anyone who tabs to it.
  function applyFilters(next: { city?: string | null; period?: string | null }) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "itinerary");
    params.set("city", next.city ?? cityFilter);
    params.set("period", next.period ?? periodFilter);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <form
      className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <input type="hidden" name="tab" value="itinerary" />
      <div className="space-y-1.5">
        <Label htmlFor="itinerary-city-filter" className="text-slate-700">{cityFilterLabel}</Label>
        <Select
          name="city"
          value={cityFilter}
          onValueChange={(value) => applyFilters({ city: value })}
          items={{ all: cityFilterAllLabel, ...Object.fromEntries(cities.map((city) => [city, city])) }}
        >
          <SelectTrigger id="itinerary-city-filter" className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{cityFilterAllLabel}</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="itinerary-period-filter" className="text-slate-700">{periodFilterLabel}</Label>
        <Select
          name="period"
          value={periodFilter}
          onValueChange={(value) => applyFilters({ period: value })}
          items={{ all: periodFilterAllLabel, ...periodLabels }}
        >
          <SelectTrigger id="itinerary-period-filter" className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{periodFilterAllLabel}</SelectItem>
            {itineraryPeriods.map((period) => (
              <SelectItem key={period} value={period}>{periodLabels[period]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-4 sm:col-span-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => applyFilters({})}
        >
          {applyFiltersLabel}
        </Button>
        {hasActiveFilters ? (
          <Link href={`${pathname}?tab=itinerary`} className="text-sm font-semibold text-primary hover:text-primary/80">
            {clearFiltersLabel}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
