import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

import { TaskCompletionDialog } from "./task-completion-dialog";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

const mocks = vi.hoisted(() => ({
  setTaskCompletion: vi.fn(),
  convertPrepTaskOnCompletion: vi.fn(),
}));

vi.mock("./actions", () => ({
  setTaskCompletion: mocks.setTaskCompletion,
  convertPrepTaskOnCompletion: mocks.convertPrepTaskOnCompletion,
}));

afterEach(cleanup);

const participants = [
  { user_id: "11111111-1111-4111-8111-111111111111", display_name: "Ana" },
];

function renderDialog(completed = false) {
  return render(
    <TaskCompletionDialog
      tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
      taskId="8f3f147b-8684-4ff1-b5c7-6814e4f57f73"
      completed={completed}
      title="Buy Lion King tickets"
      category="experiences"
      city="London"
      currency={null}
      estimatedAmount={null}
      paidAmount="150.00"
      participants={participants}
      completeLabel="Concluir"
      completingLabel="Concluindo..."
      reopenLabel="Reabrir"
      reopeningLabel="Reabrindo..."
    />,
  );
}

describe("TaskCompletionDialog", () => {
  it("completes the task and opens the conversion dialog", async () => {
    mocks.setTaskCompletion.mockResolvedValue(undefined);

    renderDialog(false);

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => {
      expect(mocks.setTaskCompletion).toHaveBeenCalled();
    });
    expect(await screen.findByText("Transformar em reserva ou item do roteiro?")).toBeTruthy();
  });

  it("reveals reservation fields, pre-filled with the task's paid amount, once checked", async () => {
    mocks.setTaskCompletion.mockResolvedValue(undefined);
    renderDialog(false);
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await screen.findByText("Transformar em reserva ou item do roteiro?");

    fireEvent.click(screen.getByLabelText("Criar reserva"));

    expect((screen.getByLabelText("Valor") as HTMLInputElement).value).toBe("150.00");
  });

  it("does not open the dialog when reopening an already-completed task", async () => {
    mocks.setTaskCompletion.mockResolvedValue(undefined);
    renderDialog(true);

    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));

    await waitFor(() => {
      expect(mocks.setTaskCompletion).toHaveBeenCalled();
    });
    expect(screen.queryByText("Transformar em reserva ou item do roteiro?")).toBeNull();
  });
});
