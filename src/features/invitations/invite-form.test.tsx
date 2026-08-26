import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { InviteForm } from "./invite-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

describe("InviteForm", () => {
  it("renders the submit button as a submit control", () => {
    render(<InviteForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    const button = screen.getByRole("button", { name: /enviar convite/i });
    expect(button.getAttribute("type")).toBe("submit");
  });
});
