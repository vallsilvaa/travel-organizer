import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { ReservationForm } from "./reservation-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "pt",
}));

afterEach(cleanup);

describe("ReservationForm", () => {
  it("renders the submit button as a submit control", () => {
    render(<ReservationForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    const button = screen.getByRole("button", { name: /adicionar reserva/i });
    expect(button.getAttribute("type")).toBe("submit");
  });
});
