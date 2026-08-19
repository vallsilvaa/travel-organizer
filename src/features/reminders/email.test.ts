import { describe, expect, it } from "vitest";

import { buildReminderEmail, getReminderWindow } from "./email";

describe("task reminder email", () => {
  it("selects the current UTC date through the next three days", () => {
    expect(getReminderWindow(new Date("2026-08-18T22:30:00Z"))).toEqual({
      start: "2026-08-18",
      end: "2026-08-21",
    });
  });

  it("identifies the trip, task, and deadline", () => {
    const message = buildReminderEmail({
      appUrl: "https://travel.example.com/",
      deadline: "2026-08-21",
      taskTitle: "Book train tickets",
      tripDestination: "Lisbon",
      tripId: "27823996-ec50-4cc2-8506-a29d07b86f94",
    });

    expect(message.subject).toContain("Lisbon");
    expect(message.text).toContain("Tarefa: Book train tickets");
    expect(message.text).toContain("Prazo: 2026-08-21");
    expect(message.text).toContain(
      "https://travel.example.com/trips/27823996-ec50-4cc2-8506-a29d07b86f94",
    );
  });

  it("escapes private content before placing it in HTML", () => {
    const message = buildReminderEmail({
      appUrl: "https://travel.example.com",
      deadline: "2026-08-21",
      taskTitle: "<script>alert('x')</script>",
      tripDestination: "A&B",
      tripId: "trip-id",
    });

    expect(message.html).toContain("A&amp;B");
    expect(message.html).not.toContain("<script>");
  });
});
