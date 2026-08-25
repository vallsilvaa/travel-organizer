import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import TripNotFound from "./not-found";

afterEach(cleanup);

describe("TripNotFound", () => {
  it("explains the likely causes without confirming which one applies", async () => {
    render(await TripNotFound());

    const message = screen.getByText(/não foi possível abrir esta viagem/i);
    expect(message.textContent).toMatch(/não existir mais/i);
    expect(message.textContent).toMatch(/excluída/i);
    expect(message.textContent).toMatch(/não ter.*acesso/i);
  });

  it("offers a way back to the dashboard", async () => {
    render(await TripNotFound());

    expect(screen.getByRole("link", { name: "Ir para o painel" }).getAttribute("href")).toBe(
      "/dashboard",
    );
  });
});
