import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    useTranslations: (namespace?: string) => createTranslator(namespace),
    useLocale: () => "pt",
  };
});
vi.mock("next-intl/server", async () => {
  const { createTranslator, ptMessages } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
    getLocale: async () => "pt",
    getMessages: async () => ptMessages,
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import ForgotPasswordPage from "./page";

afterEach(cleanup);

describe("ForgotPasswordPage", () => {
  it("renders the submit button as a submit control", async () => {
    render(await ForgotPasswordPage({ searchParams: Promise.resolve({}) }));

    const button = screen.getByRole("button", { name: /enviar link de redefinição/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("shows the same generic message regardless of whether the account exists", async () => {
    render(
      await ForgotPasswordPage({
        searchParams: Promise.resolve({ message: "check_email_reset" }),
      }),
    );

    expect(
      screen.getByText(/se esse e-mail existir, enviamos um link/i),
    ).toBeTruthy();
  });
});
