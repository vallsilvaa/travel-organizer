import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { ItineraryForm } from "./itinerary-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "pt",
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

  it("uses a single 'Local' city search and keeps the address field separately labeled 'Endereço'", () => {
    render(<ItineraryForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    expect(screen.getByLabelText(/^Local/)).toBeTruthy();
    expect(screen.getByLabelText(/^Endereço/)).toBeTruthy();
  });

  it("shows a live preview of activity + info as the user types, joined into one title (#230/R03)", () => {
    render(<ItineraryForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    expect(screen.queryByText(/Museu do Louvre/)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Hostel X"), { target: { value: "Museu do Louvre" } });
    expect(screen.getByText("Museu do Louvre")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Check-in, Visitar, Passeio por..."), {
      target: { value: "Visitar" },
    });
    expect(screen.getByText("Visitar Museu do Louvre")).toBeTruthy();
  });

  it("submits only the combined title on create - no separate action field", async () => {
    mocks.createItineraryItem.mockResolvedValue({ success: true });
    render(<ItineraryForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-09-20" } });
    fireEvent.change(screen.getByPlaceholderText("Check-in, Visitar, Passeio por..."), {
      target: { value: "Visitar" },
    });
    fireEvent.change(screen.getByPlaceholderText("Hostel X"), { target: { value: "Museu do Louvre" } });
    expect(screen.getByText("Visitar Museu do Louvre")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /adicionar ao roteiro/i }));

    await waitFor(() => {
      expect(mocks.createItineraryItem).toHaveBeenCalled();
    });
    // .at(-1): this shared mock isn't reset between tests in this file, so
    // earlier tests' submissions are still in .mock.calls - only the most
    // recent call is this test's own submit.
    const submittedFormData = mocks.createItineraryItem.mock.calls.at(-1)![1] as FormData;
    expect(submittedFormData.get("title")).toBe("Visitar Museu do Louvre");
    expect(submittedFormData.get("action")).toBeNull();
  });

  it("shows the saved title as one plain field when editing, without splitting it into activity + info", () => {
    render(
      <ItineraryForm
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
        item={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          item_date: "2026-09-20",
          start_time: null,
          title: "Check-in Hostel X",
          location: null,
          notes: null,
          period: null,
          city: null,
        }}
      />,
    );

    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Check-in Hostel X");
    expect(screen.queryByLabelText(/Atividade/)).toBeNull();
  });

  it("pre-fills the city search with a previously saved city", () => {
    render(
      <ItineraryForm
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
        item={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          item_date: "2026-09-20",
          start_time: null,
          title: "Museu do Louvre",
          location: null,
          notes: null,
          period: null,
          city: "Paris",
        }}
      />,
    );

    expect((screen.getByLabelText(/^Local/) as HTMLInputElement).value).toBe("Paris");
  });
});
