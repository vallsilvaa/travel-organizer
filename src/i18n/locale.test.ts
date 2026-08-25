import { describe, expect, it } from "vitest";

import { isLocale, localeTag, localeTags } from "./locale";

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

describe("localeTag", () => {
  it("maps a supported locale to its BCP 47 tag", () => {
    expect(localeTag("pt")).toBe("pt-BR");
    expect(localeTag("en")).toBe("en-US");
  });

  it("falls back to the default locale's tag for an unsupported value", () => {
    expect(localeTag("fr")).toBe("pt-BR");
  });
});
