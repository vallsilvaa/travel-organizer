import { redirect } from "next/navigation";

import { signOut } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name ?? user.email ?? "Traveler";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
              Travel Organizer
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Welcome, {displayName}
            </h1>
            <p className="mt-2 text-slate-600">
              Your private travel workspace is ready. Trips arrive in the next backlog item.
            </p>
          </div>
          <form action={signOut}>
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
