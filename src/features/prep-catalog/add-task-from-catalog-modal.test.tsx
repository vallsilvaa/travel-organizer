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

function renderModal(templates = [passportTemplate, colosseumTemplate], appliedTemplateIds: string[] = []) {
  render(
    <AddTaskFromCatalogModal
      templates={templates as never}
      tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
      appliedTemplateIds={appliedTemplateIds}
      {...labels}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add Tarefa" }));
}

function checkboxFor(title: string) {
  return screen.getByText(title).closest("label")!.querySelector("input[type=checkbox]") as HTMLInputElement;
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

  it("starts with nothing selected and the add button disabled", () => {
    renderModal();

    expect(screen.getByText("Nenhum selecionado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar 0 itens" }).hasAttribute("disabled")).toBe(true);
  });

  it("selecting multiple templates updates the count and enables the add button with the right label", () => {
    renderModal();

    fireEvent.click(checkboxFor("Check passport validity"));
    fireEvent.click(checkboxFor("Visit the Colosseum"));

    expect(screen.getByText("2 selecionados")).toBeTruthy();
    const addButton = screen.getByRole("button", { name: "Adicionar 2 itens" });
    expect(addButton.hasAttribute("disabled")).toBe(false);
  });

  it("unchecking a selected template removes it from the count", () => {
    renderModal();

    const passportCheckbox = checkboxFor("Check passport validity");
    fireEvent.click(passportCheckbox);
    expect(screen.getByText("1 selecionado")).toBeTruthy();

    fireEvent.click(passportCheckbox);
    expect(screen.getByText("Nenhum selecionado")).toBeTruthy();
  });

  it("Cancel closes the dialog without applying anything", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Buscar")).toBeNull();
  });

  it("disables an already-applied template's checkbox and marks it, but leaves the others selectable (#171)", () => {
    renderModal([passportTemplate, colosseumTemplate], [passportTemplate.id]);

    expect(checkboxFor("Check passport validity").disabled).toBe(true);
    expect(screen.getByText("Já adicionada")).toBeTruthy();
    expect(checkboxFor("Visit the Colosseum").disabled).toBe(false);
  });
});
