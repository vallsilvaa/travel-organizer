import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import Home from "./page";

describe("Home", () => {
  it("redirects visitors straight to sign in", () => {
    expect(() => Home()).toThrow("NEXT_REDIRECT:/auth/sign-in");
  });
});
