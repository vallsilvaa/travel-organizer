import { useRef, useState } from "react";

import type { Continent } from "./shared";

// Bundled locally (GeoNames "cities15000", CC BY 4.0 - https://www.geonames.org)
// so the autocomplete works fully offline with no API key or recurring cost
// (#209). [name, country, continent] tuples, sorted by population descending
// so more likely matches surface first once the list is truncated. Shared by
// every feature that needs a city/country search box (prep items, trip
// destinations, ...) so the ~1.2MB dataset is only ever loaded once.
export type CityRow = [string, string, Continent];

const diacriticsPattern = new RegExp("[\\u0300-\\u036f]", "g");

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(diacriticsPattern, "")
    .toLowerCase();
}

export function useCityRows() {
  const [rows, setRows] = useState<CityRow[] | null>(null);
  const loading = useRef(false);

  function loadRows() {
    if (rows || loading.current) return;
    loading.current = true;
    import("./cities.json").then((module) => {
      setRows(module.default as CityRow[]);
    });
  }

  return { rows, loadRows };
}
