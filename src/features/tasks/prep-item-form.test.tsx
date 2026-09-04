import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { PrepItemForm } from "./prep-item-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

const ownerId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";

const baseTask = {
  id: "task-1",
  title: "Book travel insurance",
  item_type: "preparation" as const,
  category: "health" as const,
  continent: "europe" as const,
  country: "Portugal",
  city: null,
  classification: "required" as const,
  due_offset_days: 30,
  currency: "EUR",
  estimated_amount: "100.00",
  paid_amount: null,
  document_instructions: null,
  owner_id: null,
  itinerary_item_id: null,
};

describe("PrepItemForm", () => {
  it("renders the submit button as a submit control", () => {
    render(
      <PrepItemForm
        itineraryItems={[]}
        participants={[]}
        task={baseTask}
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
      />,
    );

    const button = screen.getByRole("button", { name: /salvar alterações/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("shows the assigned traveler's name, not their UUID, in the closed select trigger", () => {
    render(
      <PrepItemForm
        itineraryItems={[]}
        participants={[{ user_id: ownerId, display_name: "Ana", role: "traveler" }]}
        task={{ ...baseTask, owner_id: ownerId }}
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
      />,
    );

    expect(screen.getByText("Ana (traveler)")).toBeTruthy();
    expect(screen.queryByText(ownerId)).toBeNull();
  });

  it("shows document instructions for a document_request item", () => {
    render(
      <PrepItemForm
        itineraryItems={[]}
        participants={[]}
        task={{
          ...baseTask,
          item_type: "document_request",
          document_instructions: "Upload a clear scan of your visa page.",
        }}
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
      />,
    );

    expect(screen.getByDisplayValue("Upload a clear scan of your visa page.")).toBeTruthy();
  });
});
