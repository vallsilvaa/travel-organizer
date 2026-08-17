import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InviteForm } from "@/features/invitations/invite-form";
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
  const { data: invitations } = isCreator
    ? await supabase
        .from("trip_invitations")
        .select("id, email, status, created_at")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: false })
    : { data: [] };

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
          Itinerary, tasks, comments, and expenses will appear here as the next MVP capabilities are delivered.
        </div>
      </section>
    </main>
  );
}
