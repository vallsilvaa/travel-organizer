"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const REALTIME_TABLES = [
  "itinerary_items",
  "trip_tasks",
  "item_comments",
  "trip_expenses",
] as const;

const REFRESH_DEBOUNCE_MS = 400;

export type TripRealtimeStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export function useTripRealtime(tripId: string): TripRealtimeStatus {
  const router = useRouter();
  const [status, setStatus] = useState<TripRealtimeStatus>("connecting");
  const wasConnected = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase.channel(`trip-${tripId}`);

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `trip_id=eq.${tripId}` },
        scheduleRefresh,
      );
    }

    channel.subscribe((subscriptionStatus) => {
      if (subscriptionStatus === "SUBSCRIBED") {
        // A previously connected client may have missed changes while
        // disconnected. Refreshing from the server (rather than patching a
        // client-held list) means there is nothing to reconcile and no risk
        // of duplicate items.
        if (wasConnected.current) {
          scheduleRefresh();
        }
        wasConnected.current = true;
        setStatus("connected");
      } else if (
        subscriptionStatus === "CHANNEL_ERROR" ||
        subscriptionStatus === "TIMED_OUT"
      ) {
        setStatus("reconnecting");
      } else if (subscriptionStatus === "CLOSED") {
        setStatus("disconnected");
      }
    });

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [tripId, router]);

  return status;
}
