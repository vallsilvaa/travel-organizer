import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TripNotFound from "./not-found";

afterEach(cleanup);

describe("TripNotFound", () => {
  it("explains the likely causes without confirming which one applies", () => {
    render(<TripNotFound />);

    const message = screen.getByText(/não foi possível abrir esta viagem/i);
    expect(message.textContent).toMatch(/não existir mais/i);
    expect(message.textContent).toMatch(/excluída/i);
    expect(message.textContent).toMatch(/não ter.*acesso/i);
  });

  it("offers a way back to the dashboard", () => {
    render(<TripNotFound />);

    expect(screen.getByRole("link", { name: "Ir para o painel" }).getAttribute("href")).toBe(
      "/dashboard",
    );
  });
});
