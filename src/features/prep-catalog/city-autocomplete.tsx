"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { normalize, useCityRows, type CityRow } from "./city-dataset";
import type { Continent } from "./shared";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;

export type CitySelection = {
  city: string;
  country: string;
  continent: Continent;
};

type CityAutocompleteProps = {
  id: string;
  defaultCity?: string | null;
  defaultCountry?: string | null;
  defaultContinent?: Continent | null;
  countryInputName: string;
  cityInputName: string;
  continentInputName: string;
  required?: boolean;
};

export function CityAutocomplete({
  id,
  defaultCity,
  defaultCountry,
  defaultContinent,
  countryInputName,
  cityInputName,
  continentInputName,
  required,
}: CityAutocompleteProps) {
  const t = useTranslations("cityAutocomplete");
  const { rows, loadRows } = useCityRows();
  const [query, setQuery] = useState(() =>
    defaultCity && defaultCountry ? `${defaultCity}, ${defaultCountry}` : (defaultCountry ?? ""),
  );
  // City is optional on a governed item (e.g. "renew passport" can apply to
  // a whole country) - requiring it here too used to leave `selected` null
  // for any item saved without one, which then submitted an empty
  // `continent` on the next edit (continent is otherwise only ever set
  // together with a selection) and silently failed validation.
  const [selected, setSelected] = useState<CitySelection | null>(
    defaultCountry && defaultContinent
      ? { city: defaultCity ?? "", country: defaultCountry, continent: defaultContinent }
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
  const matches = useMemo(() => {
    if (!rows || normalizedQuery.length < MIN_QUERY_LENGTH || selected) {
      return [];
    }
    const results: CityRow[] = [];
    for (const row of rows) {
      if (normalize(row[0]).includes(normalizedQuery) || normalize(row[1]).includes(normalizedQuery)) {
        results.push(row);
        if (results.length >= MAX_RESULTS) break;
      }
    }
    return results;
  }, [rows, normalizedQuery, selected]);

  function selectCity(row: CityRow) {
    const [city, country, continent] = row;
    setSelected({ city, country, continent });
    setQuery(`${city}, ${country}`);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        required={required}
        id={id}
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
      <input type="hidden" name={countryInputName} value={selected ? selected.country : query.trim()} />
      <input type="hidden" name={cityInputName} value={selected ? selected.city : ""} />
      <input type="hidden" name={continentInputName} value={selected ? selected.continent : ""} />
      {isOpen && matches.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
          {matches.map((row, index) => (
            <li key={`${row[0]}-${row[1]}-${index}`}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => selectCity(row)}
              >
                {row[0]}, {row[1]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!selected && query.trim().length >= MIN_QUERY_LENGTH && rows && matches.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{t("noMatchFallback")}</p>
      ) : null}
    </div>
  );
}
