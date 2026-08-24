import { describe, expect, it } from "vitest";

import { buildReminderEmail, getReminderWindow, isWithinReminderWindow } from "./email";

describe("task reminder email", () => {
  it("widens the UTC pre-filter by a day on each side of the 3-day window", () => {
    expect(getReminderWindow(new Date("2026-08-18T22:30:00Z"))).toEqual({
      start: "2026-08-17",
      end: "2026-08-22",
    });
  });

  it("narrows to the exact 3-day window observed in the trip's timezone", () => {
    // 2026-08-18T23:30:00Z is already 2026-08-19 in Tokyo (UTC+9).
    const now = new Date("2026-08-18T23:30:00Z");

    expect(isWithinReminderWindow("2026-08-18", "Asia/Tokyo", now)).toBe(false);
    expect(isWithinReminderWindow("2026-08-19", "Asia/Tokyo", now)).toBe(true);
    expect(isWithinReminderWindow("2026-08-22", "Asia/Tokyo", now)).toBe(true);
    expect(isWithinReminderWindow("2026-08-23", "Asia/Tokyo", now)).toBe(false);
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
