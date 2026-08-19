import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TripForm } from "./trip-form";

afterEach(cleanup);

describe("TripForm", () => {
  it("renders the create-trip button as a submit control", () => {
    render(<TripForm />);

    const button = screen.getByRole("button", { name: /criar viagem/i });
    expect(button.getAttribute("type")).toBe("submit");
  });
});
