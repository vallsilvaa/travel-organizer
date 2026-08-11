import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

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
});
