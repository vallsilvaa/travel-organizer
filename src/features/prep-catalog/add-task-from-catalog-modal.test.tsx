import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { AddTaskFromCatalogModal } from "./add-task-from-catalog-modal";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

const passportTemplate = {
  id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
  title: "Check passport validity",
  item_type: "preparation" as const,
  category: "documents" as const,
  continent: "europe" as const,
  country: "Portugal",
  city: "Lisbon",
  classification: "required" as const,
  due_offset_days: 180,
  currency: "EUR",
  estimated_amount: "50.00",
  document_instructions: null,
};

const colosseumTemplate = {
  id: "94aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Visit the Colosseum",
  item_type: "itinerary_item" as const,
  category: "experiences" as const,
  continent: null,
  country: "Italy",
  city: "Rome",
  classification: "recommended" as const,
  due_offset_days: null,
  currency: null,
  estimated_amount: null,
  document_instructions: null,
};

const labels = {
  taskCategoryLabels: { documents: "Documentos", experiences: "Experiências" } as Record<string, string>,
  prepItemTypeLabels: { preparation: "Preparação", itinerary_item: "Item de roteiro" } as Record<string, string>,
  classificationLabels: { required: "Obrigatório", recommended: "Recomendado" } as Record<string, string>,
  continentLabels: { europe: "Europa" } as Record<string, string>,
};

function renderModal(templates = [passportTemplate, colosseumTemplate]) {
  render(
    <AddTaskFromCatalogModal
      templates={templates as never}
      tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
      participants={[{ user_id: "user-1", display_name: "Alice", role: "traveler" }]}
      itineraryItems={[{ id: "item-1", title: "City walk" }]}
      {...labels}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add Tarefa" }));
}

describe("AddTaskFromCatalogModal", () => {
  it("is closed by default and lists every catalog template once opened", () => {
    renderModal();

    expect(screen.getByText("Check passport validity")).toBeTruthy();
    expect(screen.getByText("Visit the Colosseum")).toBeTruthy();
  });

  it("shows an empty-catalog message when there are no templates", () => {
    renderModal([]);

    expect(screen.getByText(/Você ainda não tem modelos no catálogo/)).toBeTruthy();
  });

  it("filters templates by search query", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "colosseum" } });

    expect(screen.queryByText("Check passport validity")).toBeNull();
    expect(screen.getByText("Visit the Colosseum")).toBeTruthy();
  });

  it("shows a no-results message when the search matches nothing", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "nonexistent" } });

    expect(screen.getByText(/Nenhum modelo encontrado/)).toBeTruthy();
  });

  it("selecting a template shows a read-only preview with Confirm and Back controls", () => {
    renderModal();

    fireEvent.click(screen.getByText("Check passport validity"));

    expect(screen.getByRole("button", { name: "Adicionar à viagem" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar à busca" })).toBeTruthy();
    expect(screen.getByText(/180 dias antes da partida/)).toBeTruthy();
  });

  it("does not show traveler/itinerary link fields for an itinerary_item template", () => {
    renderModal();

    fireEvent.click(screen.getByText("Visit the Colosseum"));

    expect(screen.queryByLabelText("Viajante responsável")).toBeNull();
    expect(screen.queryByLabelText("Item do roteiro vinculado")).toBeNull();
  });

  it("Back returns from the preview to the search list", () => {
    renderModal();

    fireEvent.click(screen.getByText("Check passport validity"));
    fireEvent.click(screen.getByRole("button", { name: "Voltar à busca" }));

    expect(screen.getByLabelText("Buscar")).toBeTruthy();
    expect(screen.getByText("Visit the Colosseum")).toBeTruthy();
  });

  it("Cancel closes the dialog without applying anything", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Buscar")).toBeNull();
  });
});
