import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next-intl/server", async () => {
  const { createFormatter, createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
    getFormatter: async () => createFormatter(),
  };
});

import SharedTripPage from "./page";

const token = "abc123token";
const trip = {
  trip_id: "27823996-ec50-4cc2-8506-a29d07b86f94",
  destination: "Lisbon",
  start_date: "2026-09-01",
  end_date: "2026-09-10",
  timezone: "Europe/Lisbon",
};
const itineraryItem = {
  id: "9ae6d984-8a52-4f7a-9cae-5d21f02c1bb9",
  item_date: "2026-09-02",
  start_time: "14:30:00",
  title: "Belém Tower",
  location: "Belém",
  city: "Lisbon",
};

afterEach(cleanup);

describe("SharedTripPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === "get_trip_by_share_token") return Promise.resolve({ data: [trip] });
      if (fn === "get_trip_itinerary_by_share_token") return Promise.resolve({ data: [itineraryItem] });
      return Promise.resolve({ data: [] });
    });
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("shows the trip and its itinerary for a valid token, without requiring auth", async () => {
    render(await SharedTripPage({ params: Promise.resolve({ token }) }));

    expect(screen.getByText("Lisbon")).toBeTruthy();
    expect(screen.getByText("Belém Tower")).toBeTruthy();
    expect(screen.getByText(/Belém.*Lisbon/)).toBeTruthy();
    expect(mocks.rpc).toHaveBeenCalledWith("get_trip_by_share_token", { p_token: token });
    expect(mocks.rpc).toHaveBeenCalledWith("get_trip_itinerary_by_share_token", { p_token: token });
  });

  it("renders a 404 for an invalid or revoked token", async () => {
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn === "get_trip_by_share_token") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    await expect(SharedTripPage({ params: Promise.resolve({ token: "revoked" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
