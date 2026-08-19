import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SignUpPage from "./page";

afterEach(cleanup);

describe("SignUpPage", () => {
  it("renders the create-account button as a submit control", async () => {
    render(await SignUpPage({ searchParams: Promise.resolve({}) }));

    const button = screen.getByRole("button", { name: /criar conta/i });
    expect(button.getAttribute("type")).toBe("submit");
  });
});
