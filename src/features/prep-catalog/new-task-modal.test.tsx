import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { NewTaskModal } from "./new-task-modal";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

describe("NewTaskModal", () => {
  it("is closed by default and opens the form when the trigger is clicked", () => {
    render(<NewTaskModal />);

    expect(screen.queryByLabelText(/título/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Criar Nova Tarefa" }));

    expect(screen.getByLabelText(/título/i)).toBeTruthy();
  });

  it("uses a custom trigger label when provided", () => {
    render(<NewTaskModal triggerLabel="Adicionar modelo" />);

    expect(screen.getByRole("button", { name: "Adicionar modelo" })).toBeTruthy();
  });

  it("shows the lead time field by default (preparation is the initial item type)", () => {
    render(<NewTaskModal />);
    fireEvent.click(screen.getByRole("button", { name: "Criar Nova Tarefa" }));

    expect(screen.getByLabelText(/dias antes da partida/i)).toBeTruthy();
  });

  it("closing the dialog does not submit the form", () => {
    render(<NewTaskModal />);
    fireEvent.click(screen.getByRole("button", { name: "Criar Nova Tarefa" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText(/título/i)).toBeNull();
  });
});
