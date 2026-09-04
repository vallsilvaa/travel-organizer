import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

const mocks = vi.hoisted(() => ({
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));
vi.mock("./actions", () => ({
  savePushSubscription: mocks.savePushSubscription,
  deletePushSubscription: mocks.deletePushSubscription,
}));

import { PushToggle } from "./push-toggle";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (navigator as any).serviceWorker;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).PushManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).Notification;
});

function stubBrowserSupport({ subscription = null }: { subscription?: object | null } = {}) {
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });

  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(subscription),
    subscribe: vi.fn().mockResolvedValue({
      endpoint: "https://push.example/endpoint",
      toJSON: () => ({
        endpoint: "https://push.example/endpoint",
        keys: { p256dh: "p256dh-value", auth: "auth-value" },
      }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    }),
  };
  const registration = { pushManager };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn().mockResolvedValue(subscription ? registration : undefined),
      register: vi.fn().mockResolvedValue(registration),
    },
  });

  return { pushManager, registration };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BEdW14i9EE70f39KANQkOYjbkGfAF4JoYjHykNQw7XztZuPU9qgWeMBbPkpBA8VXlFw0mYPBgO-z0x9PO4Do5wk";
  mocks.savePushSubscription.mockResolvedValue({ success: true });
  mocks.deletePushSubscription.mockResolvedValue({ success: true });
});

describe("PushToggle", () => {
  it("renders nothing when no VAPID public key is configured", async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    stubBrowserSupport();

    const { container } = render(<PushToggle />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it("renders nothing when the browser doesn't support push", async () => {
    const { container } = render(<PushToggle />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it("shows an Enable control when supported and not yet subscribed", async () => {
    stubBrowserSupport({ subscription: null });

    render(<PushToggle />);

    expect(await screen.findByRole("button", { name: "Ativar" })).toBeTruthy();
  });

  it("shows a Disable control when already subscribed on this device", async () => {
    stubBrowserSupport({ subscription: {} });

    render(<PushToggle />);

    expect(await screen.findByRole("button", { name: "Desativar" })).toBeTruthy();
  });

  it("enabling requests permission, subscribes, and saves the subscription", async () => {
    const { pushManager } = stubBrowserSupport({ subscription: null });

    render(<PushToggle />);
    fireEvent.click(await screen.findByRole("button", { name: "Ativar" }));

    await waitFor(() => expect(mocks.savePushSubscription).toHaveBeenCalledWith({
      endpoint: "https://push.example/endpoint",
      keys: { p256dh: "p256dh-value", auth: "auth-value" },
    }));
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Desativar" })).toBeTruthy();
  });

  it("disabling unsubscribes and deletes the saved subscription", async () => {
    const { registration } = stubBrowserSupport({ subscription: {} });
    registration.pushManager.getSubscription = vi.fn().mockResolvedValue({
      endpoint: "https://push.example/existing",
      unsubscribe: vi.fn().mockResolvedValue(true),
    });

    render(<PushToggle />);
    fireEvent.click(await screen.findByRole("button", { name: "Desativar" }));

    await waitFor(() =>
      expect(mocks.deletePushSubscription).toHaveBeenCalledWith("https://push.example/existing"),
    );
    expect(await screen.findByRole("button", { name: "Ativar" })).toBeTruthy();
  });
});
