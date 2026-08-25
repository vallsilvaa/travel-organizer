import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import { getAuthMessage } from "./messages";

describe("getAuthMessage", () => {
  it("resolves a known code to its translated message", async () => {
    expect(await getAuthMessage("invalid_credentials")).toBe("E-mail ou senha incorretos.");
  });

  it("returns null for an unknown code", async () => {
    expect(await getAuthMessage("not_a_real_code")).toBeNull();
  });

  it("returns null when no code is given", async () => {
    expect(await getAuthMessage(undefined)).toBeNull();
  });
});
