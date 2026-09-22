import type { getTranslations } from "next-intl/server";

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

type Translator = Awaited<ReturnType<typeof getTranslations<"trip">>>;

type ItineraryFiltersProps = {
  cities: string[];
  cityFilter: string;
  periodFilter: (typeof itineraryPeriods)[number] | "all";
  periodLabels: Record<(typeof itineraryPeriods)[number], string>;
  t: Translator;
};

export function ItineraryFilters({ cities, cityFilter, periodFilter, periodLabels, t }: ItineraryFiltersProps) {
  if (!cities.length) {
    return null;
  }

  return (
    <form className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
      <input type="hidden" name="tab" value="itinerary" />
      <div className="space-y-1.5">
        <Label htmlFor="itinerary-city-filter" className="text-slate-700">{t("itinerary.cityFilterLabel")}</Label>
        <Select
          name="city"
          defaultValue={cityFilter}
          items={{ all: t("itinerary.cityFilterAll"), ...Object.fromEntries(cities.map((city) => [city, city])) }}
        >
          <SelectTrigger id="itinerary-city-filter" className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("itinerary.cityFilterAll")}</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="itinerary-period-filter" className="text-slate-700">{t("itinerary.periodFilterLabel")}</Label>
        <Select
          name="period"
          defaultValue={periodFilter}
          items={{ all: t("itinerary.periodFilterAll"), ...periodLabels }}
        >
          <SelectTrigger id="itinerary-period-filter" className="w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("itinerary.periodFilterAll")}</SelectItem>
            {itineraryPeriods.map((period) => (
              <SelectItem key={period} value={period}>{periodLabels[period]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" className="sm:col-span-3 sm:justify-self-start">{t("itinerary.applyFilters")}</Button>
    </form>
  );
}
