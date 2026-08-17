"use client";

import { useActionState } from "react";

import {
  inviteOrganizer,
  type InviteOrganizerState,
} from "./actions";

const initialState: InviteOrganizerState = {};

export function InviteForm({ tripId }: { tripId: string }) {
  const [state, formAction, pending] = useActionState(
    inviteOrganizer,
    initialState,
  );

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <input type="hidden" name="tripId" value={tripId} />
      <label className="flex-1 text-sm font-medium text-slate-800">
        Organizer email
        <input
          required
          autoComplete="email"
          name="email"
          type="email"
          placeholder="organizer@example.com"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
      </label>
      <button
        disabled={pending}
        className="self-end rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Inviting..." : "Invite organizer"}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700 sm:basis-full">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-emerald-700 sm:basis-full">{state.message}</p>
      ) : null}
    </form>
  );
}
