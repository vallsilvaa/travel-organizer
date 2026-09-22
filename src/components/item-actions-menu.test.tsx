import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

import { ItemActionsMenu } from "./item-actions-menu";

afterEach(cleanup);

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Ações do item" }));
}

const baseProps = {
  editForm: <p>Formulário de edição</p>,
  deleteAction: vi.fn(),
  deleteHiddenFields: { itemId: "1" },
  deleteTitle: "Excluir?",
  deleteDescription: "Confirma a exclusão?",
};

describe("ItemActionsMenu", () => {
  it("keeps the default Editar/Excluir shape when viewContent is not passed (other tabs, unchanged)", () => {
    render(<ItemActionsMenu {...baseProps} />);

    openMenu();

    expect(screen.queryByText("Ver")).toBeNull();
    expect(screen.getByText("Editar")).toBeTruthy();
    expect(screen.getByText("Excluir")).toBeTruthy();
  });

  it("toggles the edit form open and closed via the same menu item, unchanged from before", () => {
    render(<ItemActionsMenu {...baseProps} />);

    openMenu();
    fireEvent.click(screen.getByText("Editar"));
    expect(screen.getByText("Formulário de edição")).toBeTruthy();

    openMenu();
    fireEvent.click(screen.getByText("Ocultar formulário"));
    expect(screen.queryByText("Formulário de edição")).toBeNull();
  });

  it("adds a Ver action that expands read-only content, opt-in via viewContent", () => {
    render(<ItemActionsMenu {...baseProps} viewContent={<p>Endereço: Rua X</p>} />);

    openMenu();
    expect(screen.queryByText("Endereço: Rua X")).toBeNull();

    fireEvent.click(screen.getByText("Ver"));
    expect(screen.getByText("Endereço: Rua X")).toBeTruthy();
  });

  it("closes the view panel when Editar is opened, and vice versa", () => {
    render(<ItemActionsMenu {...baseProps} viewContent={<p>Endereço: Rua X</p>} />);

    openMenu();
    fireEvent.click(screen.getByText("Ver"));
    expect(screen.getByText("Endereço: Rua X")).toBeTruthy();

    openMenu();
    fireEvent.click(screen.getByText("Editar"));
    expect(screen.queryByText("Endereço: Rua X")).toBeNull();
    expect(screen.getByText("Formulário de edição")).toBeTruthy();

    openMenu();
    fireEvent.click(screen.getByText("Ver"));
    expect(screen.getByText("Endereço: Rua X")).toBeTruthy();
    expect(screen.queryByText("Formulário de edição")).toBeNull();
  });

  it("auto-collapses edit/view once collapseOnChangeOf changes, without a manual click (R07)", () => {
    const { rerender } = render(
      <ItemActionsMenu {...baseProps} viewContent={<p>Endereço: Rua X</p>} collapseOnChangeOf="2026-09-20T10:00:00Z" />,
    );

    openMenu();
    fireEvent.click(screen.getByText("Editar"));
    expect(screen.getByText("Formulário de edição")).toBeTruthy();

    rerender(
      <ItemActionsMenu {...baseProps} viewContent={<p>Endereço: Rua X</p>} collapseOnChangeOf="2026-09-20T11:00:00Z" />,
    );

    expect(screen.queryByText("Formulário de edição")).toBeNull();
  });

  it("does not auto-collapse when collapseOnChangeOf is never passed (default, other tabs)", () => {
    const { rerender } = render(<ItemActionsMenu {...baseProps} />);

    openMenu();
    fireEvent.click(screen.getByText("Editar"));
    expect(screen.getByText("Formulário de edição")).toBeTruthy();

    rerender(<ItemActionsMenu {...baseProps} editForm={<p>Formulário de edição</p>} />);

    expect(screen.getByText("Formulário de edição")).toBeTruthy();
  });

  it("opens the delete confirmation dialog from the menu", () => {
    render(<ItemActionsMenu {...baseProps} />);

    openMenu();
    fireEvent.click(screen.getByText("Excluir"));

    expect(screen.getByText("Excluir?")).toBeTruthy();
    expect(screen.getByText("Confirma a exclusão?")).toBeTruthy();
  });
});
