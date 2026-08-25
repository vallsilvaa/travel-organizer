import { describe, expect, it } from "vitest";

import { localeTag } from "./request";

describe("localeTag", () => {
  it("maps a supported locale to its BCP 47 tag", () => {
    expect(localeTag("pt")).toBe("pt-BR");
    expect(localeTag("en")).toBe("en-US");
  });

  it("falls back to the default locale's tag for an unsupported value", () => {
    expect(localeTag("fr")).toBe("pt-BR");
  });
});
