import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { TripForm } from "./trip-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

describe("TripForm", () => {
  it("renders the create-trip button as a submit control", () => {
    render(<TripForm />);

    const button = screen.getByRole("button", { name: /criar viagem/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("falls back to the UTC default when the browser timezone can't be detected", () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("unsupported");
    });

    render(<TripForm />);

    expect((screen.getByLabelText("Fuso horário") as HTMLSelectElement).value).toBe("UTC");
    spy.mockRestore();
  });

  it("pre-selects the visitor's detected timezone for a new trip", () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: "America/Sao_Paulo" }) }) as Intl.DateTimeFormat,
    );

    render(<TripForm />);

    expect((screen.getByLabelText("Fuso horário") as HTMLSelectElement).value).toBe(
      "America/Sao_Paulo",
    );
    spy.mockRestore();
  });

  it("prefills the edit form and renders a save button", () => {
    render(<TripForm trip={{
      id: "27823996-ec50-4cc2-8506-a29d07b86f94",
      destination: "Lisboa",
      start_date: "2026-09-01",
      end_date: "2026-09-10",
      timezone: "Europe/Lisbon",
    }} />);

    expect((screen.getByLabelText("Destino") as HTMLInputElement).value).toBe("Lisboa");
    expect((screen.getByLabelText("Data de início") as HTMLInputElement).value).toBe("2026-09-01");
    expect((screen.getByLabelText("Fuso horário") as HTMLSelectElement).value).toBe("Europe/Lisbon");
    expect(screen.getByRole("button", { name: /salvar alterações/i }).getAttribute("type")).toBe("submit");
  });
});
