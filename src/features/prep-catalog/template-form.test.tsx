import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { TemplateForm } from "./template-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "pt",
}));

afterEach(cleanup);

describe("TemplateForm", () => {
  it("renders the submit button as a submit control for a new template", () => {
    render(<TemplateForm />);

    const button = screen.getByRole("button", { name: /adicionar modelo/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("does not show a separate continent field, but does offer a Local (city/country) search", () => {
    render(<TemplateForm />);

    expect(screen.queryByLabelText(/continente/i)).toBeNull();
    expect(screen.getByLabelText("Local")).toBeTruthy();
  });

  it("shows document instructions for an existing document_request template", () => {
    render(
      <TemplateForm
        template={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          title: "Provide visa scan",
          action: null,
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
          action: null,
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

  it("does not show a lead time field for an itinerary_item template", () => {
    render(
      <TemplateForm
        template={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          title: "Visit the Colosseum",
          action: null,
          item_type: "itinerary_item",
          category: "experiences",
          continent: "europe",
          country: "Italy",
          city: null,
          classification: "recommended",
          due_offset_days: null,
          currency: null,
          estimated_amount: null,
          document_instructions: null,
        }}
      />,
    );

    expect(screen.queryByLabelText(/dias antes da partida/i)).toBeNull();
  });

  it("shows a free-text day input pre-filled when the saved lead time isn't one of the presets (#206)", () => {
    const { container } = render(
      <TemplateForm
        template={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          title: "Custom lead time task",
          action: null,
          item_type: "preparation",
          category: "documents",
          continent: "europe",
          country: "Portugal",
          city: null,
          classification: "required",
          due_offset_days: 45,
          currency: null,
          estimated_amount: null,
          document_instructions: null,
        }}
      />,
    );

    const customInput = container.querySelector('input[name="dueOffsetDays"][type="number"]') as HTMLInputElement;
    expect(customInput).toBeTruthy();
    expect(customInput.value).toBe("45");
  });

  it("carries a preset lead time via a hidden field instead of the free-text input", () => {
    const { container } = render(
      <TemplateForm
        template={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          title: "Preset lead time task",
          action: null,
          item_type: "preparation",
          category: "documents",
          continent: "europe",
          country: "Portugal",
          city: null,
          classification: "required",
          due_offset_days: 30,
          currency: null,
          estimated_amount: null,
          document_instructions: null,
        }}
      />,
    );

    const hiddenInput = container.querySelector('input[name="dueOffsetDays"][type="hidden"]') as HTMLInputElement;
    expect(hiddenInput).toBeTruthy();
    expect(hiddenInput.value).toBe("30");
    expect(container.querySelector('input[name="dueOffsetDays"][type="number"]')).toBeNull();
  });

  it("carries a tripId as a hidden field for a new template, but not when editing", () => {
    const { container, unmount } = render(
      <TemplateForm tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />,
    );
    expect((container.querySelector('input[name="tripId"]') as HTMLInputElement).value).toBe(
      "27823996-ec50-4cc2-8506-a29d07b86f94",
    );
    unmount();

    render(
      <TemplateForm
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
        template={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          title: "Check passport validity",
          action: null,
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
    expect(document.querySelector('input[name="tripId"]')).toBeNull();
  });

  it("resubmits the saved city, country, and continent unchanged", () => {
    const { container } = render(
      <TemplateForm
        template={{
          id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
          title: "Check passport validity",
          action: null,
          item_type: "preparation",
          category: "documents",
          continent: "europe",
          country: "Portugal",
          city: "Lisboa",
          classification: "required",
          due_offset_days: 180,
          currency: null,
          estimated_amount: null,
          document_instructions: null,
        }}
      />,
    );

    const formData = new FormData(container.querySelector("form") as HTMLFormElement);
    expect(formData.get("city")).toBe("Lisboa");
    expect(formData.get("country")).toBe("Portugal");
    expect(formData.get("continent")).toBe("europe");
  });
});
