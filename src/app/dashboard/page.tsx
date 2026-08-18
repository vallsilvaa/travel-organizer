import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/features/auth/actions";
import { respondToInvitation } from "@/features/invitations/actions";
import { updateReminderPreference } from "@/features/reminders/actions";
import { TripForm } from "@/features/trips/trip-form";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams: Promise<{ invitationError?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const [{ data: profile }, { data: trips, error: tripsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, task_reminders_enabled")
        .eq("id", user.id)
        .single(),
      supabase
        .from("trips")
        .select("id, destination, start_date, end_date")
        .order("start_date", { ascending: true }),
    ]);

  const displayName = profile?.display_name ?? user.email ?? "Traveler";
  const { data: pendingInvitations, error: invitationsError } = user.email
    ? await supabase
        .from("trip_invitations")
        .select("id, trip_id, trip_destination, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const invitationError = params.invitationError
    ? "The invitation is no longer available or could not be updated."
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
              Travel Organizer
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Welcome, {displayName}
            </h1>
            <p className="mt-2 text-slate-600">
              Create a trip and keep its planning details in one private workspace.
            </p>
          </div>
          <form action={signOut}>
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Email reminders
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Receive a reminder when an assigned task is due within the next three days.
        </p>
        <form action={updateReminderPreference} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              name="taskRemindersEnabled"
              defaultChecked={profile?.task_reminders_enabled ?? true}
              className="h-5 w-5 rounded border-slate-300 text-sky-700"
            />
            Send task deadline reminders
          </label>
          <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Save preference
          </button>
        </form>
      </section>

      {pendingInvitations?.length || invitationError || invitationsError ? (
        <section className="rounded-3xl border border-sky-200 bg-sky-50 p-8 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Trip invitations
          </h2>
          {invitationError || invitationsError ? (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {invitationError ?? "We could not load your invitations."}
            </p>
          ) : null}
          {pendingInvitations?.length ? (
            <ul className="mt-5 space-y-3">
              {pendingInvitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="rounded-2xl border border-sky-200 bg-white p-5"
                >
                  <p className="font-semibold text-slate-950">
                    {invitation.trip_destination}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    You were invited to collaborate as the travel organizer.
                  </p>
                  <form action={respondToInvitation} className="mt-4 flex gap-3">
                    <input
                      type="hidden"
                      name="invitationId"
                      value={invitation.id}
                    />
                    <button
                      name="response"
                      value="accepted"
                      className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
                    >
                      Accept
                    </button>
                    <button
                      name="response"
                      value="declined"
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Decline
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Create a trip
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Start with the destination and dates. More planning tools will be added inside the trip.
        </p>
        <TripForm />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Your trips
        </h2>

        {tripsError ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            We could not load your trips. Try refreshing the page.
          </p>
        ) : trips?.length ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  className="block h-full rounded-2xl border border-slate-200 p-5 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  <h3 className="text-lg font-semibold text-slate-950">
                    {trip.destination}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatDate(trip.start_date)}
                    {trip.end_date ? ` – ${formatDate(trip.end_date)}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
            No trips yet. Create your first trip above.
          </p>
        )}
      </section>
      </div>
    </main>
  );
}
