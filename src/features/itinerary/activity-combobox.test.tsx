import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { ActivityCombobox } from "./activity-combobox";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

const suggestions = ["Check-in", "Visitar"];

// ActivityCombobox is fully controlled (#230/R03) - this harness stands in
// for the parent form (ItineraryForm/TemplateForm), which is what actually
// owns the `activity` state.
function Harness({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <div>
      <ActivityCombobox
        id="activity"
        value={value}
        onValueChange={setValue}
        suggestions={suggestions}
        placeholder="Check-in, Visitar..."
      />
      <p data-testid="value">{value}</p>
    </div>
  );
}

describe("ActivityCombobox", () => {
  it("mirrors typed text as the value, without requiring a selection", () => {
    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText("Check-in, Visitar..."), {
      target: { value: "Praia noturna" },
    });

    expect(screen.getByTestId("value").textContent).toBe("Praia noturna");
  });

  it("fills the value when a suggestion is clicked", async () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Check-in, Visitar...");

    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "Check" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const option = await waitFor(() => screen.getByRole("option", { name: "Check-in" }));
    fireEvent.click(option);

    expect(screen.getByTestId("value").textContent).toBe("Check-in");
  });

  it("offers an 'Adicionar' entry for text that matches no suggestion, and selecting it keeps that text", async () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Check-in, Visitar...");

    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "Praia noturna" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const addOption = await waitFor(() => screen.getByRole("option", { name: /Praia noturna/ }));
    expect(addOption.textContent).toMatch(/Praia noturna/);
    fireEvent.click(addOption);

    expect(screen.getByTestId("value").textContent).toBe("Praia noturna");
  });

  it("does not offer an 'Adicionar' entry for text that already matches a suggestion", async () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Check-in, Visitar...");

    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "Check-in" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    await waitFor(() => screen.getByRole("option", { name: "Check-in" }));
    expect(screen.queryByText(/Adicionar/)).toBeNull();
  });

  it("supports keyboard navigation: ArrowDown highlights a suggestion and Enter selects it", async () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Check-in, Visitar...");

    fireEvent.focus(input);
    // First ArrowDown only opens the popup - base-ui's `Autocomplete`
    // (selectionMode: "none", unlike `Combobox`) doesn't auto-highlight the
    // first item on open (`focusItemOnOpen` is false whenever
    // `autoHighlight` isn't set), on purpose: auto-highlighting on open
    // would make a stray Enter commit a suggestion the visitor never
    // actually navigated to while free-typing. A second ArrowDown moves the
    // highlight onto the first item.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => screen.getByRole("option", { name: "Check-in" }));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("value").textContent).toBe("Check-in");
  });

  it("pre-fills the input from an existing value", () => {
    render(<Harness initialValue="Check-in" />);

    expect((screen.getByPlaceholderText("Check-in, Visitar...") as HTMLInputElement).value).toBe("Check-in");
  });

  it("keeps typed text on blur even without an explicit selection (regression, #239/R12)", () => {
    // Base-ui's `Combobox` primitive (selectionMode: "single") reverts the
    // input back to the last *selected* item when it loses focus without an
    // explicit selection - wiping free-typed text like "Visitar" right back
    // to "". This component is built on `Autocomplete` (selectionMode:
    // "none") specifically so blurring after typing, without clicking a
    // suggestion or pressing Enter, preserves what was typed.
    render(<Harness />);
    const input = screen.getByPlaceholderText("Check-in, Visitar...");

    fireEvent.change(input, { target: { value: "Visitar" } });
    fireEvent.blur(input);

    expect(screen.getByTestId("value").textContent).toBe("Visitar");
    expect((input as HTMLInputElement).value).toBe("Visitar");
  });
});
