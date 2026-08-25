import { describe, expect, it } from "vitest";

import { isLocale, localeTags } from "./locale";

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("pt")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  it("rejects unsupported or missing values", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale("")).toBe(false);
  });
});

describe("localeTags", () => {
  it("maps every supported locale to a BCP 47 tag", () => {
    expect(localeTags.pt).toBe("pt-BR");
    expect(localeTags.en).toBe("en-US");
  });
});
