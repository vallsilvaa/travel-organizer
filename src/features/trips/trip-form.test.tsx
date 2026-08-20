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

  it("prefills the edit form and renders a save button", () => {
    render(<TripForm trip={{
      id: "27823996-ec50-4cc2-8506-a29d07b86f94",
      destination: "Lisboa",
      start_date: "2026-09-01",
      end_date: "2026-09-10",
    }} />);

    expect((screen.getByLabelText("Destino") as HTMLInputElement).value).toBe("Lisboa");
    expect((screen.getByLabelText("Data de início") as HTMLInputElement).value).toBe("2026-09-01");
    expect(screen.getByRole("button", { name: /salvar alterações/i }).getAttribute("type")).toBe("submit");
  });
});
