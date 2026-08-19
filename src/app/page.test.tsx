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

    const signUpLinks = screen.getAllByRole("link", { name: /create account/i });
    const signInLinks = screen.getAllByRole("link", { name: /sign in/i });

    expect(signUpLinks.length).toBeGreaterThan(0);
    expect(signInLinks.length).toBeGreaterThan(0);
    expect(
      signUpLinks.every((link) => link.getAttribute("href") === "/auth/sign-up"),
    ).toBe(true);
    expect(
      signInLinks.every((link) => link.getAttribute("href") === "/auth/sign-in"),
    ).toBe(true);
  });

  it("summarizes the planning features", () => {
    render(<Home />);

    for (const feature of ["Itinerary", "Tasks", "Expenses", "Collaboration"]) {
      expect(
        screen.getByRole("heading", { level: 2, name: feature }),
      ).toBeDefined();
    }
  });
});
