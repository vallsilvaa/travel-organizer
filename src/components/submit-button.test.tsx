import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useFormStatus: vi.fn(),
}));

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: mocks.useFormStatus,
}));

import { SubmitButton } from "./submit-button";

afterEach(cleanup);

describe("SubmitButton", () => {
  beforeEach(() => {
    mocks.useFormStatus.mockReturnValue({
      pending: false,
      data: null,
      method: null,
      action: null,
    });
  });

  it("renders an enabled submit control by default", () => {
    render(
      <form>
        <SubmitButton pendingLabel="Salvando...">Salvar</SubmitButton>
      </form>,
    );

    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("prevents duplicate submissions and announces pending feedback", () => {
    mocks.useFormStatus.mockReturnValue({
      pending: true,
      data: new FormData(),
      method: "post",
      action: null,
    });

    render(
      <form>
        <SubmitButton pendingLabel="Salvando...">Salvar</SubmitButton>
      </form>,
    );

    const button = screen.getByRole("button", { name: "Salvando..." });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Salvando...").getAttribute("aria-live")).toBe("polite");
  });
});
