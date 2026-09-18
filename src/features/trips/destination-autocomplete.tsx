"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { normalize, useCityRows, type CityRow } from "@/features/prep-catalog/city-dataset";
import type { Continent } from "@/features/prep-catalog/shared";

export type DestinationGranularity = "city" | "country";

export type DestinationSelection = {
  label: string;
  city: string | null;
  country: string;
  continent: Continent | null;
  granularity: DestinationGranularity;
};

const MIN_QUERY_LENGTH = 2;
const MAX_CITY_RESULTS = 6;
const MAX_COUNTRY_RESULTS = 3;

type Suggestion =
  | { kind: "city"; city: string; country: string; continent: Continent }
  | { kind: "country"; country: string; continent: Continent };

type DestinationAutocompleteProps = {
  id: string;
  ariaLabel: string;
  defaultLabel?: string | null;
  defaultCity?: string | null;
  defaultCountry?: string | null;
  defaultContinent?: Continent | null;
  defaultGranularity?: DestinationGranularity | null;
  labelInputName: string;
  cityInputName: string;
  countryInputName: string;
  continentInputName: string;
  granularityInputName: string;
  required?: boolean;
};

// Reuses the same bundled city dataset as CityAutocomplete (see
// features/prep-catalog/city-dataset.ts), but a trip destination can also be
// just a country - so every distinct country in the dataset is offered as
// its own suggestion alongside city matches, instead of only degrading to a
// free-text country on a query with zero city matches.
export function DestinationAutocomplete({
  id,
  ariaLabel,
  defaultLabel,
  defaultCity,
  defaultCountry,
  defaultContinent,
  defaultGranularity,
  labelInputName,
  cityInputName,
  countryInputName,
  continentInputName,
  granularityInputName,
  required,
}: DestinationAutocompleteProps) {
  const t = useTranslations("trip.destinationAutocomplete");
  const { rows, loadRows } = useCityRows();
  const [query, setQuery] = useState(() => defaultLabel ?? defaultCountry ?? "");
  const [selected, setSelected] = useState<DestinationSelection | null>(
    defaultCountry && defaultGranularity
      ? {
          label: defaultLabel ?? defaultCountry,
          city: defaultCity ?? null,
          country: defaultCountry,
          continent: defaultContinent ?? null,
          granularity: defaultGranularity,
        }
      : null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedQuery = normalize(query.trim());
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!rows || normalizedQuery.length < MIN_QUERY_LENGTH || selected) {
      return [];
    }
    const cityMatches: Suggestion[] = [];
    const countryMatches: Suggestion[] = [];
    const seenCountries = new Set<string>();
    for (const row of rows as CityRow[]) {
      const [city, country, continent] = row;
      const countryMatchesQuery = normalize(country).includes(normalizedQuery);
      if (countryMatchesQuery && !seenCountries.has(country) && countryMatches.length < MAX_COUNTRY_RESULTS) {
        seenCountries.add(country);
        countryMatches.push({ kind: "country", country, continent });
      }
      if (
        cityMatches.length < MAX_CITY_RESULTS
        && (normalize(city).includes(normalizedQuery) || countryMatchesQuery)
      ) {
        cityMatches.push({ kind: "city", city, country, continent });
      }
      if (countryMatches.length >= MAX_COUNTRY_RESULTS && cityMatches.length >= MAX_CITY_RESULTS) {
        break;
      }
    }
    return [...countryMatches, ...cityMatches];
  }, [rows, normalizedQuery, selected]);

  function selectSuggestion(suggestion: Suggestion) {
    const next: DestinationSelection =
      suggestion.kind === "city"
        ? {
            label: `${suggestion.city}, ${suggestion.country}`,
            city: suggestion.city,
            country: suggestion.country,
            continent: suggestion.continent,
            granularity: "city",
          }
        : {
            label: suggestion.country,
            city: null,
            country: suggestion.country,
            continent: suggestion.continent,
            granularity: "country",
          };
    setSelected(next);
    setQuery(next.label);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        required={required}
        id={id}
        aria-label={ariaLabel}
        autoComplete="off"
        value={query}
        placeholder={t("placeholder")}
        onFocus={() => {
          loadRows();
          setIsOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(null);
          setIsOpen(true);
          loadRows();
        }}
      />
      <input type="hidden" name={labelInputName} value={selected ? selected.label : query.trim()} />
      <input type="hidden" name={cityInputName} value={selected?.city ?? ""} />
      <input type="hidden" name={countryInputName} value={selected ? selected.country : query.trim()} />
      <input type="hidden" name={continentInputName} value={selected?.continent ?? ""} />
      <input type="hidden" name={granularityInputName} value={selected ? selected.granularity : "country"} />
      {isOpen && suggestions.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.kind}-${suggestion.country}-${suggestion.kind === "city" ? suggestion.city : ""}-${index}`}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => selectSuggestion(suggestion)}
              >
                <span>
                  {suggestion.kind === "city" ? `${suggestion.city}, ${suggestion.country}` : suggestion.country}
                </span>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {suggestion.kind === "city" ? t("cityBadge") : t("countryBadge")}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!selected && query.trim().length >= MIN_QUERY_LENGTH && rows && suggestions.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t("noMatchFallback")}</p>
      ) : null}
    </div>
  );
}
