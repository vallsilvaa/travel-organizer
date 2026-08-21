import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import NotFound from "./not-found";

afterEach(cleanup);

describe("NotFound", () => {
  it("shows a branded message and a way back", () => {
    render(<NotFound />);

    expect(screen.getByText("Página não encontrada")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir para o painel" }).getAttribute("href")).toBe(
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Página inicial" }).getAttribute("href")).toBe("/");
  });
});
