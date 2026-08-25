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

import SignUpPage from "./page";

afterEach(cleanup);

describe("SignUpPage", () => {
  it("renders the create-account button as a submit control", async () => {
    render(await SignUpPage({ searchParams: Promise.resolve({}) }));

    const button = screen.getByRole("button", { name: /criar conta/i });
    expect(button.getAttribute("type")).toBe("submit");
  });
});
