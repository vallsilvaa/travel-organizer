import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { TaskForm } from "./task-form";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

afterEach(cleanup);

describe("TaskForm", () => {
  it("renders the submit button as a submit control", () => {
    render(<TaskForm participants={[]} tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    const button = screen.getByRole("button", { name: /adicionar tarefa/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("shows the owner's name, not their UUID, in the closed select trigger", () => {
    const ownerId = "8f3f147b-8684-4ff1-b5c7-6814e4f57f73";
    render(
      <TaskForm
        participants={[{ user_id: ownerId, display_name: "Ana", role: "organizer" }]}
        task={{
          id: "task-1",
          title: "Comprar ingressos",
          owner_id: ownerId,
          due_date: null,
          category: "other",
          is_critical: false,
          reference_label: null,
          reference_url: null,
        }}
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
      />,
    );

    expect(screen.getByText("Ana (organizer)")).toBeTruthy();
    expect(screen.queryByText(ownerId)).toBeNull();
  });
});
