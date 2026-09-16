import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { ItineraryForm } from "./itinerary-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

const mocks = vi.hoisted(() => ({
  createItineraryItem: vi.fn(),
  updateItineraryItem: vi.fn(),
}));

vi.mock("./actions", () => ({
  createItineraryItem: mocks.createItineraryItem,
  updateItineraryItem: mocks.updateItineraryItem,
}));

afterEach(cleanup);

describe("ItineraryForm", () => {
  it("renders the submit button as a submit control", () => {
    render(<ItineraryForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    const button = screen.getByRole("button", { name: /adicionar ao roteiro/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("clears the fields after successfully adding a new item (#204)", async () => {
    mocks.createItineraryItem.mockResolvedValue({ success: true });

    render(<ItineraryForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    const titleInput = screen.getByLabelText("Título") as HTMLInputElement;
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-09-20" } });
    fireEvent.change(titleInput, { target: { value: "Museu do Louvre" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar ao roteiro/i }));

    await waitFor(() => {
      expect(mocks.createItineraryItem).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("");
    });
  });
});
