import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { NewItineraryItemModal } from "./new-item-modal";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "pt",
}));

const mocks = vi.hoisted(() => ({
  saveNewItineraryItem: vi.fn(),
}));

vi.mock("./actions", () => ({
  saveNewItineraryItem: mocks.saveNewItineraryItem,
}));

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";

function openModal() {
  render(<NewItineraryItemModal tripId={tripId} />);
  fireEvent.click(screen.getByRole("button", { name: "Novo item de roteiro" }));
}

function closeViaXButton() {
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.saveNewItineraryItem.mockReset();
  mocks.saveNewItineraryItem.mockResolvedValue({});
});

afterEach(cleanup);

describe("NewItineraryItemModal (#231/R04)", () => {
  it("is closed by default and opens the modal from the trigger", () => {
    render(<NewItineraryItemModal tripId={tripId} />);

    expect(screen.queryByLabelText(/Título/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Novo item de roteiro" }));

    expect(screen.getByLabelText(/Título/)).toBeTruthy();
  });

  it("marks required fields with * and never shows the '(opcional)' suffix used elsewhere in the app", () => {
    openModal();

    expect(screen.getByText("Data *")).toBeTruthy();
    expect(screen.getByText("Título *")).toBeTruthy();
    expect(screen.queryByText(/opcional/)).toBeNull();
  });

  it("keeps 'Horário fim' disabled until 'Horário início' has a value", () => {
    openModal();

    const endTime = screen.getByLabelText("Horário de término") as HTMLInputElement;
    expect(endTime.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "09:00" } });
    expect(endTime.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "" } });
    expect(endTime.disabled).toBe(true);
  });

  it("Cancelar discards the draft - reopening shows no restored notice and an empty form", () => {
    openModal();
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Louvre" } });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Novo item de roteiro" }));

    expect(screen.queryByText("Rascunho restaurado")).toBeNull();
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe("");
  });

  it("closing via Fechar (Esc/click-outside's equivalent close request) saves a draft, restored on reopen", () => {
    openModal();
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Louvre" } });
    fireEvent.change(screen.getByLabelText(/^Endereço/), { target: { value: "Rue de Rivoli" } });

    closeViaXButton();
    fireEvent.click(screen.getByRole("button", { name: "Novo item de roteiro" }));

    expect(screen.getByText("Rascunho restaurado")).toBeTruthy();
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe("Louvre");
    expect((screen.getByLabelText(/^Endereço/) as HTMLInputElement).value).toBe("Rue de Rivoli");
  });

  it("does not save an empty draft when closed without typing anything", () => {
    openModal();
    closeViaXButton();
    fireEvent.click(screen.getByRole("button", { name: "Novo item de roteiro" }));

    expect(screen.queryByText("Rascunho restaurado")).toBeNull();
  });

  it("submits 'Salvar' with mode=full, including the combined activity+info title", async () => {
    mocks.saveNewItineraryItem.mockResolvedValue({ success: true, createdDate: "2026-10-12" });
    openModal();

    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-10-12" } });
    fireEvent.change(screen.getByLabelText("Atividade"), { target: { value: "Visitar" } });
    fireEvent.change(screen.getByPlaceholderText("Hostel X"), { target: { value: "Louvre" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.saveNewItineraryItem).toHaveBeenCalled());
    const submittedFormData = mocks.saveNewItineraryItem.mock.calls.at(-1)![1] as FormData;
    expect(submittedFormData.get("mode")).toBe("full");
    expect(submittedFormData.get("title")).toBe("Visitar Louvre");
    expect(submittedFormData.get("date")).toBe("2026-10-12");
  });

  it("keeps a typed 'Atividade' that was never explicitly selected when focus moves to the next field (regression, #239/R12)", async () => {
    // Reproduces the real e2e failure: typing into the free-text activity
    // combobox and tabbing away (no click on a suggestion, no Enter) must
    // not revert the typed text - see ActivityCombobox/Autocomplete's doc
    // comments for why base-ui's `Combobox` primitive used to do exactly
    // that on blur.
    mocks.saveNewItineraryItem.mockResolvedValue({ success: true, createdDate: "2026-10-12" });
    openModal();

    const activityInput = screen.getByLabelText("Atividade");
    fireEvent.change(activityInput, { target: { value: "Visitar" } });
    fireEvent.blur(activityInput);
    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-10-12" } });
    fireEvent.change(screen.getByPlaceholderText("Hostel X"), { target: { value: "Louvre" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.saveNewItineraryItem).toHaveBeenCalled());
    const submittedFormData = mocks.saveNewItineraryItem.mock.calls.at(-1)![1] as FormData;
    expect(submittedFormData.get("title")).toBe("Visitar Louvre");
  });

  it("submits 'Salvar só como modelo' with mode=templateOnly", async () => {
    mocks.saveNewItineraryItem.mockResolvedValue({ success: true });
    openModal();

    fireEvent.change(screen.getByPlaceholderText("Hostel X"), { target: { value: "Louvre" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar só como modelo" }));

    await waitFor(() => expect(mocks.saveNewItineraryItem).toHaveBeenCalled());
    const submittedFormData = mocks.saveNewItineraryItem.mock.calls.at(-1)![1] as FormData;
    expect(submittedFormData.get("mode")).toBe("templateOnly");
  });

  it("clears the draft and closes the modal after a successful save", async () => {
    mocks.saveNewItineraryItem.mockResolvedValue({ success: true, createdDate: "2026-10-12" });
    openModal();

    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-10-12" } });
    fireEvent.change(screen.getByPlaceholderText("Hostel X"), { target: { value: "Louvre" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.queryByLabelText(/Título/)).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Novo item de roteiro" }));
    expect(screen.queryByText("Rascunho restaurado")).toBeNull();
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe("");
  });
});

describe("NewItineraryItemModal 'fromTemplate' prop (#232/R05)", () => {
  const templateId = "c2c6cf9e-0d68-4f5a-8f0c-1c4f4c9b1a11";

  function renderFromTemplate(onOpenChange = vi.fn()) {
    render(
      <NewItineraryItemModal
        tripId={tripId}
        fromTemplate={{
          id: templateId,
          title: "Louvre",
          location: "Rue de Rivoli",
          open: true,
          onOpenChange,
        }}
      />,
    );
    return onOpenChange;
  }

  it("mounts already open with no trigger button, pre-filled from the template", () => {
    renderFromTemplate();

    expect(screen.queryByRole("button", { name: "Novo item de roteiro" })).toBeNull();
    expect((screen.getByLabelText(/Título/) as HTMLInputElement).value).toBe("Louvre");
    expect((screen.getByLabelText(/^Endereço/) as HTMLInputElement).value).toBe("Rue de Rivoli");
  });

  it("only offers 'Salvar' - no 'Salvar só como modelo' escape hatch", () => {
    renderFromTemplate();

    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar só como modelo" })).toBeNull();
  });

  it("submits mode=fromTemplate with the template id, keeping edits to the pre-filled title", async () => {
    mocks.saveNewItineraryItem.mockResolvedValue({ success: true, createdDate: "2026-10-12" });
    renderFromTemplate();

    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-10-12" } });
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Louvre (manhã)" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.saveNewItineraryItem).toHaveBeenCalled());
    const submittedFormData = mocks.saveNewItineraryItem.mock.calls.at(-1)![1] as FormData;
    expect(submittedFormData.get("mode")).toBe("fromTemplate");
    expect(submittedFormData.get("templateId")).toBe(templateId);
    expect(submittedFormData.get("title")).toBe("Louvre (manhã)");
    expect(submittedFormData.get("date")).toBe("2026-10-12");
  });

  it("requires a date - the server rejects an empty one the same as a full save", async () => {
    mocks.saveNewItineraryItem.mockResolvedValue({ errors: { date: "Informe uma data válida." } });
    renderFromTemplate();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.saveNewItineraryItem).toHaveBeenCalled());
    expect(await screen.findByText("Informe uma data válida.")).toBeTruthy();
  });

  it("calls the caller's onOpenChange(false) instead of an internal close on Cancelar", () => {
    const onOpenChange = renderFromTemplate();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
