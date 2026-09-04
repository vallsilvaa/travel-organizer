import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { OrganizerTripExtras } from "./organizer-trip-extras";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

const templates = [
  { id: "template-1", title: "Check passport validity", category: "documents", country: "Portugal", city: "Lisbon" },
  { id: "template-2", title: "Visit the Colosseum", category: "experiences", country: "Italy", city: "Rome" },
];

describe("OrganizerTripExtras", () => {
  it("renders a hidden organizerContext marker", () => {
    const { container } = render(<OrganizerTripExtras templates={templates} />);

    expect((container.querySelector('input[name="organizerContext"]') as HTMLInputElement).value).toBe("true");
  });

  it("lists every catalog task as a selectable checkbox by default", () => {
    render(<OrganizerTripExtras templates={templates} />);

    expect(screen.getByText("Check passport validity")).toBeTruthy();
    expect(screen.getByText("Visit the Colosseum")).toBeTruthy();
  });

  it("filters the task list by search query", () => {
    render(<OrganizerTripExtras templates={templates} />);

    fireEvent.change(screen.getByPlaceholderText("Buscar tarefas do catálogo"), {
      target: { value: "colosseum" },
    });

    expect(screen.queryByText("Check passport validity")).toBeNull();
    expect(screen.getByText("Visit the Colosseum")).toBeTruthy();
  });

  it("checking a task box submits its id under taskTemplateIds", () => {
    const { container } = render(<OrganizerTripExtras templates={templates} />);

    const checkbox = screen.getByText("Check passport validity")
      .closest("label")!
      .querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.name).toBe("taskTemplateIds");
    expect(checkbox.value).toBe("template-1");
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(true);
    expect(container.querySelectorAll('input[name="taskTemplateIds"]:checked')).toHaveLength(1);
  });

  it("shows an empty-catalog message and no search box when there are no templates", () => {
    render(<OrganizerTripExtras templates={[]} />);

    expect(screen.getByText(/Você ainda não tem modelos no catálogo/)).toBeTruthy();
    expect(screen.queryByPlaceholderText("Buscar tarefas do catálogo")).toBeNull();
  });

  it("renders an optional invite-by-email field", () => {
    render(<OrganizerTripExtras templates={templates} />);

    const emailInput = screen.getByLabelText("Adicionar viajante (opcional)") as HTMLInputElement;
    expect(emailInput.name).toBe("inviteEmail");
    expect(emailInput.type).toBe("email");
    expect(emailInput.required).toBe(false);
  });
});
