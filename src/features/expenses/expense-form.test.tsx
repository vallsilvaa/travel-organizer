import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { ExpenseForm } from "./expense-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

const tripId = "27823996-ec50-4cc2-8506-a29d07b86f94";
const alice = { user_id: "11111111-1111-1111-1111-111111111111", display_name: "Alice", role: "organizer" };
const bob = { user_id: "22222222-2222-2222-2222-222222222222", display_name: "Bob", role: "traveler" };

afterEach(cleanup);

describe("ExpenseForm", () => {
  it("renders the submit button as a submit control", () => {
    render(<ExpenseForm participants={[]} tripId={tripId} />);

    const button = screen.getByRole("button", { name: /adicionar despesa/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("does not show the split section until enabled", () => {
    render(<ExpenseForm participants={[alice, bob]} tripId={tripId} />);

    expect(screen.queryByText(/igualmente/i)).toBeNull();
  });

  it("splits the amount equally across selected participants once enabled", () => {
    render(<ExpenseForm participants={[alice, bob]} tripId={tripId} />);

    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "10.00" } });
    fireEvent.click(screen.getByText("Dividir despesa entre participantes"));

    expect(screen.getByText("Dividido: 10.00 / 10.00")).toBeTruthy();
  });

  it("disables submit while a custom split does not match the total", () => {
    render(<ExpenseForm participants={[alice, bob]} tripId={tripId} />);

    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "10.00" } });
    fireEvent.click(screen.getByText("Dividir despesa entre participantes"));
    fireEvent.click(screen.getByText("Personalizado"));

    const amountInputs = screen.getAllByRole("spinbutton");
    const aliceShareInput = amountInputs[amountInputs.length - 2];
    fireEvent.change(aliceShareInput, { target: { value: "3.00" } });

    const submitButton = screen.getByRole("button", { name: /adicionar despesa/i });
    expect(submitButton.hasAttribute("disabled")).toBe(true);
  });
});
