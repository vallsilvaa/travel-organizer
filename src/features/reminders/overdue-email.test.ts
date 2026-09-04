import { describe, expect, it } from "vitest";

import { buildOverdueTasksEmail } from "./overdue-email";

describe("overdue tasks digest email", () => {
  it("names every task once, in one digest per trip", () => {
    const message = buildOverdueTasksEmail({
      appUrl: "https://travel.example.com/",
      tripDestination: "Lisbon",
      tripId: "27823996-ec50-4cc2-8506-a29d07b86f94",
      tasks: [
        { title: "Book train tickets", ownerName: "Alice", dueDate: "2026-08-10", daysOverdue: 3 },
        { title: "Renew passport", ownerName: "Bob", dueDate: "2026-08-12", daysOverdue: 1 },
      ],
    });

    expect(message.subject).toContain("2 tarefas atrasadas");
    expect(message.subject).toContain("Lisbon");
    expect(message.text).toContain("Book train tickets");
    expect(message.text).toContain("Renew passport");
    expect(message.text).toContain("Alice");
    expect(message.text).toContain("Bob");
    expect(message.text).toContain("3 dias atrasada");
    expect(message.text).toContain("1 dia atrasada");
    expect(message.text).toContain(
      "https://travel.example.com/trips/27823996-ec50-4cc2-8506-a29d07b86f94?tab=preparation",
    );
  });

  it("uses singular subject wording for a single overdue task", () => {
    const message = buildOverdueTasksEmail({
      appUrl: "https://travel.example.com",
      tripDestination: "Rome",
      tripId: "trip-id",
      tasks: [{ title: "Buy travel insurance", ownerName: "Alice", dueDate: "2026-08-10", daysOverdue: 2 }],
    });

    expect(message.subject).toContain("1 tarefa atrasada");
  });

  it("escapes private content before placing it in HTML", () => {
    const message = buildOverdueTasksEmail({
      appUrl: "https://travel.example.com",
      tripDestination: "A&B",
      tripId: "trip-id",
      tasks: [{ title: "<script>alert('x')</script>", ownerName: "Alice", dueDate: "2026-08-10", daysOverdue: 1 }],
    });

    expect(message.html).toContain("A&amp;B");
    expect(message.html).not.toContain("<script>");
  });
});
