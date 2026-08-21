import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn(),
  createClient: vi.fn(),
  router: { refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  // Next.js guarantees a stable router reference across renders; the mock
  // must too, or every state update below would tear down and resubscribe
  // the channel.
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

import { useTripRealtime } from "./use-trip-realtime";

type Callback = (payload: unknown) => void;

function createFakeChannel() {
  const listeners: Callback[] = [];
  let subscribeCallback: ((status: string) => void) | undefined;

  const fakeChannel = {
    on: vi.fn((_event: string, _filter: unknown, callback: Callback) => {
      listeners.push(callback);
      return fakeChannel;
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      subscribeCallback = callback;
      return fakeChannel;
    }),
    emit: () => listeners.forEach((listener) => listener({})),
    setStatus: (status: string) => subscribeCallback?.(status),
  };

  return fakeChannel;
}

describe("useTripRealtime", () => {
  let fakeChannel: ReturnType<typeof createFakeChannel>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    fakeChannel = createFakeChannel();
    mocks.channel.mockReturnValue(fakeChannel);
    mocks.createClient.mockReturnValue({
      channel: mocks.channel,
      removeChannel: mocks.removeChannel,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to itinerary, task, comment, and expense changes scoped to the trip", () => {
    renderHook(() => useTripRealtime("trip-1"));

    expect(mocks.channel).toHaveBeenCalledWith("trip-trip-1");
    const subscribedTables = fakeChannel.on.mock.calls.map(
      (call) => (call[1] as { table: string; filter: string }).table,
    );
    expect(subscribedTables).toEqual([
      "itinerary_items",
      "trip_tasks",
      "item_comments",
      "trip_expenses",
    ]);
    for (const call of fakeChannel.on.mock.calls) {
      const filterArg = call[1] as { filter: string };
      expect(filterArg.filter).toBe("trip_id=eq.trip-1");
    }
  });

  it("reports connected once the channel subscribes", () => {
    const { result } = renderHook(() => useTripRealtime("trip-1"));

    expect(result.current).toBe("connecting");

    act(() => fakeChannel.setStatus("SUBSCRIBED"));

    expect(result.current).toBe("connected");
    expect(mocks.router.refresh).not.toHaveBeenCalled();
  });

  it("debounces a refresh after a change event", () => {
    renderHook(() => useTripRealtime("trip-1"));
    act(() => fakeChannel.setStatus("SUBSCRIBED"));

    act(() => fakeChannel.emit());
    act(() => fakeChannel.emit());
    expect(mocks.router.refresh).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(400));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("reports reconnecting on channel errors and refreshes once back online", () => {
    const { result } = renderHook(() => useTripRealtime("trip-1"));
    act(() => fakeChannel.setStatus("SUBSCRIBED"));
    mocks.router.refresh.mockClear();

    act(() => fakeChannel.setStatus("CHANNEL_ERROR"));
    expect(result.current).toBe("reconnecting");

    act(() => fakeChannel.setStatus("SUBSCRIBED"));
    expect(result.current).toBe("connected");
    act(() => vi.advanceTimersByTime(400));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderHook(() => useTripRealtime("trip-1"));
    unmount();

    expect(mocks.removeChannel).toHaveBeenCalledWith(fakeChannel);
  });
});
