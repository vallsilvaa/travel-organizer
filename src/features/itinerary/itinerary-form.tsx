"use client";

import { useActionState } from "react";

import {
  createItineraryItem,
  updateItineraryItem,
  type ItineraryActionState,
} from "./actions";

type ItineraryFormProps = {
  item?: {
    id: string;
    item_date: string;
    start_time: string | null;
    title: string;
    location: string | null;
    notes: string | null;
  };
  tripId: string;
};

const initialState: ItineraryActionState = {};

export function ItineraryForm({ item, tripId }: ItineraryFormProps) {
  const action = item ? updateItineraryItem : createItineraryItem;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <label className="text-sm font-medium text-slate-800">
        Date
        <input
          required
          name="date"
          type="date"
          defaultValue={item?.item_date}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.date ? <span className="mt-1 block text-red-700">{state.errors.date}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Time <span className="font-normal text-slate-500">(optional)</span>
        <input
          name="time"
          type="time"
          defaultValue={item?.start_time?.slice(0, 5)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.time ? <span className="mt-1 block text-red-700">{state.errors.time}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800 sm:col-span-2">
        Title
        <input
          required
          maxLength={200}
          name="title"
          defaultValue={item?.title}
          placeholder="Museum visit"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.title ? <span className="mt-1 block text-red-700">{state.errors.title}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800 sm:col-span-2">
        Location <span className="font-normal text-slate-500">(optional)</span>
        <input
          maxLength={200}
          name="location"
          defaultValue={item?.location ?? ""}
          placeholder="Address or meeting point"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.location ? <span className="mt-1 block text-red-700">{state.errors.location}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800 sm:col-span-2">
        Notes <span className="font-normal text-slate-500">(optional)</span>
        <textarea
          maxLength={2000}
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={3}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.notes ? <span className="mt-1 block text-red-700">{state.errors.notes}</span> : null}
      </label>
      {state.message ? (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">{state.message}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-700 sm:col-span-2">
          {item ? "Itinerary item updated." : "Itinerary item added."}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Saving..." : item ? "Save changes" : "Add to itinerary"}
      </button>
    </form>
  );
}
