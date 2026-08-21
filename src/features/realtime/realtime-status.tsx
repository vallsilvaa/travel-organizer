"use client";

import { useTripRealtime } from "./use-trip-realtime";

const statusLabels = {
  connecting: "Conectando...",
  connected: "Ao vivo",
  reconnecting: "Reconectando...",
  disconnected: "Desconectado",
} as const;

const statusDotClass = {
  connecting: "bg-slate-400",
  connected: "bg-emerald-500",
  reconnecting: "bg-amber-500",
  disconnected: "bg-red-500",
} as const;

export function RealtimeStatus({ tripId }: { tripId: string }) {
  const status = useTripRealtime(tripId);

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${statusDotClass[status]}`}
        aria-hidden="true"
      />
      {statusLabels[status]}
    </span>
  );
}
