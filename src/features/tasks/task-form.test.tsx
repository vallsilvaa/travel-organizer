import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TaskForm } from "./task-form";

afterEach(cleanup);

describe("TaskForm", () => {
  it("renders the submit button as a submit control", () => {
    render(<TaskForm participants={[]} tripId="27823996-ec50-4cc2-8506-a29d07b86f94" />);

    const button = screen.getByRole("button", { name: /adicionar tarefa/i });
    expect(button.getAttribute("type")).toBe("submit");
  });
});
