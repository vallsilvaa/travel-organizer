import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("introduces the product", async () => {
    render(await Home());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /tudo para sua próxima viagem/i,
      }),
    ).toBeDefined();
  });

  it("links visitors to the authentication flows", async () => {
    render(await Home());

    expect(
      screen.getByRole("link", { name: /criar conta/i }).getAttribute("href"),
    ).toBe("/auth/sign-up");
    expect(
      screen.getByRole("link", { name: /entrar/i }).getAttribute("href"),
    ).toBe("/auth/sign-in");
  });
});
