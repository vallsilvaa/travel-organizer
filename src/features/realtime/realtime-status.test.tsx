import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

const mocks = vi.hoisted(() => ({
  useTripRealtime: vi.fn(),
}));

vi.mock("./use-trip-realtime", () => ({
  useTripRealtime: mocks.useTripRealtime,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
}));

import { RealtimeStatus } from "./realtime-status";

afterEach(cleanup);

describe("RealtimeStatus", () => {
  it("shows a connected label once live", () => {
    mocks.useTripRealtime.mockReturnValue("connected");
    render(<RealtimeStatus tripId="trip-1" />);

    expect(screen.getByRole("status").textContent).toContain("Ao vivo");
  });

  it("shows a reconnecting label while the channel recovers", () => {
    mocks.useTripRealtime.mockReturnValue("reconnecting");
    render(<RealtimeStatus tripId="trip-1" />);

    expect(screen.getByRole("status").textContent).toContain("Reconectando...");
  });
});
