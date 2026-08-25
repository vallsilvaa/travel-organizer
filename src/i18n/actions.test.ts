import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.set }),
}));

import { setLocale } from "./actions";

describe("setLocale", () => {
  it("persists a supported locale in the cookie", async () => {
    await setLocale("en");

    expect(mocks.set).toHaveBeenCalledWith(
      "NEXT_LOCALE",
      "en",
      expect.objectContaining({ path: "/" }),
    );
  });

  it("ignores an unsupported locale", async () => {
    mocks.set.mockClear();

    await setLocale("fr");

    expect(mocks.set).not.toHaveBeenCalled();
  });
});
