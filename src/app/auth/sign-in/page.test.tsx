import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SignInPage from "./page";

afterEach(cleanup);

describe("SignInPage", () => {
  it("renders the sign-in button as a submit control", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    const button = screen.getByRole("button", { name: /entrar/i });
    expect(button).toHaveAttribute("type", "submit");
  });
});
