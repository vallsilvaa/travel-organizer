import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { CoverImageForm } from "./cover-image-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

describe("CoverImageForm", () => {
  it("without a cover: shows only an add-cover entry point until clicked", () => {
    render(<CoverImageForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" hasCoverImage={false} />);

    expect(screen.getByRole("button", { name: "Adicionar capa" })).toBeTruthy();
    expect(screen.queryByLabelText("Imagem de capa")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover capa" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar capa" }));

    expect(screen.getByLabelText("Imagem de capa")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar capa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });

  it("cancel returns to the idle state without a file input", () => {
    render(<CoverImageForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" hasCoverImage={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar capa" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Imagem de capa")).toBeNull();
    expect(screen.getByRole("button", { name: "Adicionar capa" })).toBeTruthy();
  });

  it("with a cover: offers edit and remove entry points", () => {
    render(<CoverImageForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" hasCoverImage />);

    expect(screen.getByRole("button", { name: "Editar capa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover capa" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Editar capa" }));

    expect(screen.getByLabelText("Imagem de capa")).toBeTruthy();
  });
});
