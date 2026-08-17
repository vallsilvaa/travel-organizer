import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InviteForm } from "@/features/invitations/invite-form";
import { deleteItineraryItem } from "@/features/itinerary/actions";
import { ItineraryForm } from "@/features/itinerary/itinerary-form";
import { createClient } from "@/lib/supabase/server";

type TripPageProps = {
  params: Promise<{ tripId: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "Time not defined";
}

export default async function TripPage({ params }: TripPageProps) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, destination, start_date, end_date, created_at, created_by")
    .eq("id", tripId)
    .single();

  if (error || !trip) {
    notFound();
  }

  const isCreator = trip.created_by === user.id;
  const [{ data: itineraryItems, error: itineraryError }, invitationResult] =
    await Promise.all([
      supabase
        .from("itinerary_items")
        .select("id, item_date, start_time, title, location, notes")
        .eq("trip_id", trip.id)
        .order("item_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false }),
      isCreator
        ? supabase
            .from("trip_invitations")
            .select("id, email, status, created_at")
            .eq("trip_id", trip.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
  const invitations = invitationResult.data;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-sky-700 hover:text-sky-800"
        >
          ← Back to dashboard
        </Link>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
          Trip overview
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          {trip.destination}
        </h1>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-5">
            <dt className="text-sm font-medium text-slate-500">Start date</dt>
            <dd className="mt-2 text-lg font-semibold text-slate-950">
              {formatDate(trip.start_date)}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <dt className="text-sm font-medium text-slate-500">End date</dt>
            <dd className="mt-2 text-lg font-semibold text-slate-950">
              {trip.end_date ? formatDate(trip.end_date) : "Not defined"}
            </dd>
          </div>
        </dl>

        <section className="mt-8 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold text-slate-950">Itinerary</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Keep activities, reservations, and meeting points in chronological order.
          </p>

          <details className="mt-5 rounded-2xl bg-sky-50 p-5" open={!itineraryItems?.length}>
            <summary className="cursor-pointer font-semibold text-sky-900">
              Add itinerary item
            </summary>
            <div className="mt-5">
              <ItineraryForm tripId={trip.id} />
            </div>
          </details>

          {itineraryError ? (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              We could not load the itinerary. Try refreshing the page.
            </p>
          ) : itineraryItems?.length ? (
            <ol className="mt-6 space-y-4">
              {itineraryItems.map((item) => (
                <li key={item.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-sky-700">
                        {formatDate(item.item_date)} · {formatTime(item.start_time)}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">{item.title}</h3>
                      {item.location ? <p className="mt-1 text-sm text-slate-600">{item.location}</p> : null}
                      {item.notes ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.notes}</p> : null}
                    </div>
                    <form action={deleteItineraryItem}>
                      <input type="hidden" name="tripId" value={trip.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <button className="text-sm font-semibold text-red-700 hover:text-red-800">
                        Delete
                      </button>
                    </form>
                  </div>
                  <details className="mt-4 border-t border-slate-200 pt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-sky-700">
                      Edit item
                    </summary>
                    <div className="mt-4">
                      <ItineraryForm item={item} tripId={trip.id} />
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              No itinerary items yet. Add the first activity above.
            </p>
          )}
        </section>

        {isCreator ? (
          <section className="mt-8 rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              Travel organizer
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Invite an organizer by email. They can accept after signing in with the same address.
            </p>
            <InviteForm tripId={trip.id} />

            {invitations?.length ? (
              <ul className="mt-6 divide-y divide-slate-200 border-t border-slate-200">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {invitation.email}
                    </span>
                    <span className="text-sm capitalize text-slate-500">
                      {invitation.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-6 text-sm leading-6 text-slate-600">
          Tasks, comments, and expenses will appear here as the next MVP capabilities are delivered.
        </div>
      </section>
    </main>
  );
}
