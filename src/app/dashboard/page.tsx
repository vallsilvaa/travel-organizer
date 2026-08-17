import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/features/auth/actions";
import { TripForm } from "@/features/trips/trip-form";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function DashboardPage() {
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
        .select("display_name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("trips")
        .select("id, destination, start_date, end_date")
        .order("start_date", { ascending: true }),
    ]);

  const displayName = profile?.display_name ?? user.email ?? "Traveler";

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
