import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NotificationBell, type Notification } from "./notification-bell";

afterEach(cleanup);

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "8f3f147b-8684-4ff1-b5c7-6814e4f57f73",
    notification_type: "comment",
    title: "Novo comentário",
    body: "Alguém comentou em uma tarefa",
    link_path: "/trips/27823996-ec50-4cc2-8506-a29d07b86f94?tab=preparation",
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationBell", () => {
  it("shows an unread count badge when there are unread notifications", () => {
    render(<NotificationBell notifications={[makeNotification(), makeNotification({ read_at: new Date().toISOString() })]} />);

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText(/1 não lidas/i)).toBeTruthy();
  });

  it("shows no badge when every notification has been read", () => {
    render(<NotificationBell notifications={[makeNotification({ read_at: new Date().toISOString() })]} />);

    expect(screen.queryByText("1")).toBeNull();
  });
});
