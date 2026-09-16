import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { CityAutocomplete } from "./city-autocomplete";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

describe("CityAutocomplete", () => {
  it("shows suggestions once at least 2 characters are typed, and fills the hidden fields on selection", async () => {
    const { container } = render(
      <CityAutocomplete
        id="city"
        countryInputName="country"
        cityInputName="city"
        continentInputName="continent"
      />,
    );

    fireEvent.change(container.querySelector("input#city") as HTMLInputElement, {
      target: { value: "Lisb" },
    });

    const option = await waitFor(() => screen.getByRole("button", { name: "Lisbon, Portugal" }));
    fireEvent.click(option);

    expect((container.querySelector('input[name="country"]') as HTMLInputElement).value).toBe("Portugal");
    expect((container.querySelector('input[name="city"]') as HTMLInputElement).value).toBe("Lisbon");
    expect((container.querySelector('input[name="continent"]') as HTMLInputElement).value).toBe("europe");
  });

  it("falls back to the typed text as the country when nothing is selected", async () => {
    const { container } = render(
      <CityAutocomplete
        id="city"
        countryInputName="country"
        cityInputName="city"
        continentInputName="continent"
      />,
    );

    fireEvent.change(container.querySelector("input#city") as HTMLInputElement, {
      target: { value: "Neverland" },
    });

    await waitFor(() => {
      expect((container.querySelector('input[name="country"]') as HTMLInputElement).value).toBe("Neverland");
    });
    expect((container.querySelector('input[name="city"]') as HTMLInputElement).value).toBe("");
  });

  it("pre-fills the visible input with the existing city and country when editing", () => {
    const { container } = render(
      <CityAutocomplete
        id="city"
        defaultCity="Lisbon"
        defaultCountry="Portugal"
        defaultContinent="europe"
        countryInputName="country"
        cityInputName="city"
        continentInputName="continent"
      />,
    );

    expect((container.querySelector("input#city") as HTMLInputElement).value).toBe("Lisbon, Portugal");
    expect((container.querySelector('input[name="continent"]') as HTMLInputElement).value).toBe("europe");
  });
});
