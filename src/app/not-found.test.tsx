import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import NotFound from "./not-found";

afterEach(cleanup);

describe("NotFound", () => {
  it("shows a branded message and a way back", async () => {
    render(await NotFound());

    expect(screen.getByText("Página não encontrada")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir para o painel" }).getAttribute("href")).toBe(
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Página inicial" }).getAttribute("href")).toBe("/");
  });
});
