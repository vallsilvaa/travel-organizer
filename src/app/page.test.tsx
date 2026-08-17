import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("introduces the product", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /everything for your next trip/i,
      }),
    ).toBeDefined();
  });

  it("links visitors to the authentication flows", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: /create account/i }).getAttribute("href"),
    ).toBe("/auth/sign-up");
    expect(
      screen.getByRole("link", { name: /sign in/i }).getAttribute("href"),
    ).toBe("/auth/sign-in");
  });
});
