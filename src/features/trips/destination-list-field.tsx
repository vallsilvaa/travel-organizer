"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { DestinationAutocomplete, type DestinationGranularity } from "./destination-autocomplete";
import type { Continent } from "@/features/prep-catalog/shared";

export type DestinationFieldValue = {
  label: string;
  city: string | null;
  country: string;
  continent: Continent | null;
  granularity: DestinationGranularity;
};

type DestinationRow = DestinationFieldValue & { key: string };

type DestinationListFieldProps = {
  initialDestinations?: DestinationFieldValue[];
};

const emptyRow: DestinationFieldValue = {
  label: "",
  city: null,
  country: "",
  continent: null,
  granularity: "country",
};

export function DestinationListField({ initialDestinations }: DestinationListFieldProps) {
  const t = useTranslations("trip.editForm");
  const fieldId = useId();
  const [rows, setRows] = useState<DestinationRow[]>(() => {
    const seed = initialDestinations?.length ? initialDestinations : [emptyRow];
    // Only runs once for the initial render, so plain index-based keys are
    // stable - no mutable counter (e.g. a ref) needed just to seed them.
    return seed.map((destination, index) => ({ ...destination, key: `seed-${index}` }));
  });

  function addRow() {
    setRows((current) => [...current, { ...emptyRow, key: crypto.randomUUID() }]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>{t("destinationsLabel")}</Label>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.key} className="flex items-start gap-2">
            <div className="flex-1">
              <DestinationAutocomplete
                id={`${fieldId}-destination-${index}`}
                ariaLabel={t("destinationInputLabel", { index: index + 1 })}
                required
                defaultLabel={row.label}
                defaultCity={row.city}
                defaultCountry={row.country}
                defaultContinent={row.continent}
                defaultGranularity={row.granularity}
                labelInputName="destinationLabel"
                cityInputName="destinationCity"
                countryInputName="destinationCountry"
                continentInputName="destinationContinent"
                granularityInputName="destinationGranularity"
              />
            </div>
            {rows.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(row.key)}
                aria-label={t("removeDestinationButton")}
              >
                {t("removeDestinationButton")}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        {t("addDestinationButton")}
      </Button>
    </div>
  );
}
