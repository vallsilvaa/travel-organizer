import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    useTranslations: (namespace?: string) => createTranslator(namespace),
  };
});

import ErrorPage from "./error";

afterEach(cleanup);

describe("ErrorPage", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("logs the error and offers a way to retry or leave", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    const reset = vi.fn();

    render(<ErrorPage error={error} reset={reset} />);

    expect(screen.getByText("Algo deu errado")).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(reset).toHaveBeenCalledOnce();

    expect(screen.getByRole("link", { name: "Ir para o painel" }).getAttribute("href")).toBe(
      "/dashboard",
    );
  });
});
