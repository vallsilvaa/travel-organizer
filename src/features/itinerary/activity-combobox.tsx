"use client";

import { useTranslations } from "next-intl";

import {
  Combobox,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";

type ActivityComboboxProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
};

// Free-text combobox: unlike a real Select, the committed value is always
// whatever is currently typed (`value`/`onValueChange` mirror the input as
// the visitor types, not a "confirmed selection" state) - picking a
// suggestion or the "Adicionar" entry just fills that same text in, exactly
// like the `<input list>` datalist it replaces (#230/R03). It never submits
// itself - callers combine `value` with the rest of the form and send it
// through their own hidden field (see ItineraryForm/TemplateForm).
export function ActivityCombobox({ id, value, onValueChange, suggestions, placeholder }: ActivityComboboxProps) {
  const t = useTranslations("activityCombobox");
  const trimmed = value.trim();
  const hasExactMatch = suggestions.some((suggestion) => suggestion.toLowerCase() === trimmed.toLowerCase());
  const items = trimmed && !hasExactMatch ? [...suggestions, trimmed] : suggestions;

  return (
    <Combobox<string>
      items={items}
      inputValue={value}
      onInputValueChange={(next) => onValueChange(next)}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
    >
      <ComboboxInputGroup>
        <ComboboxInput id={id} placeholder={placeholder} autoComplete="off" />
        <ComboboxIcon />
      </ComboboxInputGroup>
      <ComboboxPopup>
        <ComboboxEmpty>{t("empty")}</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item === trimmed && !hasExactMatch ? t("addOption", { value: item }) : item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
