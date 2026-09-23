"use client";

import { useTranslations } from "next-intl";

import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteIcon,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@/components/ui/autocomplete";

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
//
// This is built on base-ui's `Autocomplete` (`selectionMode: "none"`), not
// `Combobox` (`selectionMode: "single"`). `Combobox`'s `Input`, when it
// lives outside `Popup` (as here), reverts the input's text back to the
// last *selected* item on blur/close if the user typed without explicitly
// selecting anything - see `AriaCombobox`'s `handleUnmount`. That silently
// wiped free-typed activity text (e.g. typing "Visitar" and tabbing to the
// next field cleared it back to "") - `Autocomplete` has no such "selected
// value" to revert to, so what's typed is always what's kept.
export function ActivityCombobox({ id, value, onValueChange, suggestions, placeholder }: ActivityComboboxProps) {
  const t = useTranslations("activityCombobox");
  const trimmed = value.trim();
  const hasExactMatch = suggestions.some((suggestion) => suggestion.toLowerCase() === trimmed.toLowerCase());
  const items = trimmed && !hasExactMatch ? [...suggestions, trimmed] : suggestions;

  return (
    <Autocomplete<string> items={items} value={value} onValueChange={(next) => onValueChange(next)}>
      <AutocompleteInputGroup>
        <AutocompleteInput id={id} placeholder={placeholder} autoComplete="off" />
        <AutocompleteIcon />
      </AutocompleteInputGroup>
      <AutocompletePopup>
        <AutocompleteEmpty>{t("empty")}</AutocompleteEmpty>
        <AutocompleteList>
          {(item: string) => (
            <AutocompleteItem key={item} value={item}>
              {item === trimmed && !hasExactMatch ? t("addOption", { value: item }) : item}
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompletePopup>
    </Autocomplete>
  );
}
