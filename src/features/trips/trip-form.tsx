"use client";

import { useActionState } from "react";

import { createTrip, type CreateTripState } from "./actions";

const initialState: CreateTripState = {};

export function TripForm() {
  const [state, formAction, pending] = useActionState(createTrip, initialState);

  return (
    <form action={formAction} className="mt-6 grid gap-5 sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
        Destination
        <input
          required
          maxLength={200}
          name="destination"
          placeholder="London, United Kingdom"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          aria-describedby={state.errors?.destination ? "destination-error" : undefined}
        />
        {state.errors?.destination ? (
          <span id="destination-error" className="mt-1 block text-sm text-red-700">
            {state.errors.destination}
          </span>
        ) : null}
      </label>

      <label className="block text-sm font-medium text-slate-800">
        Start date
        <input
          required
          name="startDate"
          type="date"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          aria-describedby={state.errors?.startDate ? "start-date-error" : undefined}
        />
        {state.errors?.startDate ? (
          <span id="start-date-error" className="mt-1 block text-sm text-red-700">
            {state.errors.startDate}
          </span>
        ) : null}
      </label>

      <label className="block text-sm font-medium text-slate-800">
        End date <span className="font-normal text-slate-500">(optional)</span>
        <input
          name="endDate"
          type="date"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          aria-describedby={state.errors?.endDate ? "end-date-error" : undefined}
        />
        {state.errors?.endDate ? (
          <span id="end-date-error" className="mt-1 block text-sm text-red-700">
            {state.errors.endDate}
          </span>
        ) : null}
      </label>

      {state.message ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
          {state.message}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          disabled={pending}
          className="rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating trip..." : "Create trip"}
        </button>
      </div>
    </form>
  );
}
