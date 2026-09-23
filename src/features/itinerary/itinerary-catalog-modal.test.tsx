import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { ItineraryCatalogModal, type ItineraryCatalogTemplate } from "./itinerary-catalog-modal";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

// NewItineraryItemModal has its own full test coverage (new-item-modal.test.tsx,
// including its "fromTemplate" prop) and pulls in useActionState/saveNewItineraryItem -
// stubbed here so this file can stay focused on ItineraryCatalogModal's own
// job: search/filter and handing the picked template to the next step.
vi.mock("./new-item-modal", () => ({
  NewItineraryItemModal: (props: {
    fromTemplate?: { id: string; title: string; location: string | null };
  }) =>
    props.fromTemplate ? (
      <div data-testid="new-item-modal-stub">
        {`${props.fromTemplate.id}|${props.fromTemplate.title}|${props.fromTemplate.location ?? ""}`}
      </div>
    ) : null,
}));

afterEach(cleanup);

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";

const louvreTemplate: ItineraryCatalogTemplate = {
  id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
  title: "Visitar o Louvre",
  location: "Rue de Rivoli, Paris",
};

const colosseumTemplate: ItineraryCatalogTemplate = {
  id: "94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Visitar o Coliseu",
  location: "Piazza del Colosseo, Rome",
};

function renderModal(templates = [louvreTemplate, colosseumTemplate]) {
  render(<ItineraryCatalogModal tripId={tripId} templates={templates} />);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar do catálogo" }));
}

describe("ItineraryCatalogModal (#232/R05)", () => {
  it("is closed by default and lists every template once opened", () => {
    renderModal();

    expect(screen.getByText("Visitar o Louvre")).toBeTruthy();
    expect(screen.getByText("Visitar o Coliseu")).toBeTruthy();
  });

  it("shows an empty-catalog message when there are no itinerary_item templates", () => {
    renderModal([]);

    expect(screen.getByText(/Você ainda não tem itens de roteiro salvos/)).toBeTruthy();
  });

  it("filters by title", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "louvre" } });

    expect(screen.getByText("Visitar o Louvre")).toBeTruthy();
    expect(screen.queryByText("Visitar o Coliseu")).toBeNull();
  });

  it("filters by address (location), not just title", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "rivoli" } });

    expect(screen.getByText("Visitar o Louvre")).toBeTruthy();
    expect(screen.queryByText("Visitar o Coliseu")).toBeNull();
  });

  it("shows a no-results message when the search matches nothing", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "nonexistent" } });

    expect(screen.getByText(/Nenhum item encontrado/)).toBeTruthy();
  });

  it("does not mount the item form before any template is selected", () => {
    renderModal();

    expect(screen.queryByTestId("new-item-modal-stub")).toBeNull();
  });

  it("selecting a template closes the search list and hands title/location to the item form", () => {
    renderModal();

    fireEvent.click(screen.getByText("Visitar o Louvre"));

    expect(screen.queryByLabelText("Buscar")).toBeNull();
    expect(screen.getByTestId("new-item-modal-stub").textContent).toBe(
      `${louvreTemplate.id}|Visitar o Louvre|Rue de Rivoli, Paris`,
    );
  });
});
