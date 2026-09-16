import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { ReservationForm } from "./reservation-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "pt",
}));

const mocks = vi.hoisted(() => ({
  createReservation: vi.fn(),
  updateReservation: vi.fn(),
}));

vi.mock("./actions", () => ({
  createReservation: mocks.createReservation,
  updateReservation: mocks.updateReservation,
}));

afterEach(cleanup);

describe("ReservationForm", () => {
  it("renders the submit button as a submit control", () => {
    render(<ReservationForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    const button = screen.getByRole("button", { name: /adicionar reserva/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  const participants = [
    { user_id: "11111111-1111-4111-8111-111111111111", display_name: "Ana" },
    { user_id: "22222222-2222-4222-8222-222222222222", display_name: "Bruno" },
  ];

  it("shows a per-person split preview once an amount is entered and more than one responsible person is checked (#205)", () => {
    render(<ReservationForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" participants={participants} />);

    fireEvent.change(screen.getByLabelText(/^Valor/), { target: { value: "100" } });
    fireEvent.click(screen.getByLabelText("Ana"));
    fireEvent.click(screen.getByLabelText("Bruno"));

    expect(screen.getByText("50.00 por pessoa (2 responsáveis)")).toBeTruthy();
  });

  it("clears fields and resets payment status/responsible selections after successfully adding a new reservation (#204)", async () => {
    mocks.createReservation.mockResolvedValue({ success: true });

    render(<ReservationForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" participants={participants} />);

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Taxi ao museu" } });
    fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-09-20" } });
    fireEvent.change(screen.getByLabelText(/^Valor/), { target: { value: "100" } });
    fireEvent.click(screen.getByLabelText("A pagar"));
    fireEvent.click(screen.getByLabelText("Ana"));

    fireEvent.click(screen.getByRole("button", { name: /adicionar reserva/i }));

    await waitFor(() => {
      expect(mocks.createReservation).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("");
    });
    expect((screen.getByLabelText(/^Valor/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Pago") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Ana") as HTMLInputElement).checked).toBe(false);
  });

  it("pre-fills payment status and responsible checkboxes when editing an existing reservation (#205)", () => {
    render(
      <ReservationForm
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
        participants={participants}
        reservation={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          reservation_type: "lodging",
          title: "Hotel Baixa",
          provider: null,
          confirmation_code: null,
          start_date: "2026-10-12",
          start_time: null,
          end_date: null,
          end_time: null,
          location: null,
          destination_location: null,
          notes: null,
          itinerary_item_id: null,
          paid_amount: "300.00",
          currency: "EUR",
          payment_status: "to_pay",
          responsible_ids: [participants[0].user_id, participants[1].user_id],
        }}
      />,
    );

    const toPayRadio = screen.getByLabelText("A pagar") as HTMLInputElement;
    expect(toPayRadio.checked).toBe(true);
    expect((screen.getByLabelText("Ana") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Bruno") as HTMLInputElement).checked).toBe(true);
  });
});
