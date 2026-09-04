import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { TemplateForm } from "./template-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

describe("TemplateForm", () => {
  it("renders the submit button as a submit control for a new template", () => {
    render(<TemplateForm />);

    const button = screen.getByRole("button", { name: /adicionar modelo/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("shows document instructions for an existing document_request template", () => {
    render(
      <TemplateForm
        template={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          title: "Provide visa scan",
          item_type: "document_request",
          category: "documents",
          continent: "europe",
          country: "Portugal",
          city: null,
          classification: "required",
          due_offset_days: 90,
          currency: "EUR",
          estimated_amount: null,
          document_instructions: "Upload a clear scan of your visa page.",
        }}
      />,
    );

    expect(screen.getByDisplayValue("Upload a clear scan of your visa page.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /salvar alterações/i })).toBeTruthy();
  });

  it("does not show document instructions for a preparation template", () => {
    render(
      <TemplateForm
        template={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          title: "Check passport validity",
          item_type: "preparation",
          category: "documents",
          continent: "europe",
          country: "Portugal",
          city: null,
          classification: "required",
          due_offset_days: 180,
          currency: null,
          estimated_amount: null,
          document_instructions: null,
        }}
      />,
    );

    expect(screen.queryByLabelText(/instruções da documentação/i)).toBeNull();
  });
});
