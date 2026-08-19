import {
  ArrowRightIcon,
  BellIcon,
  MailIcon,
  MapPinnedIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldLabel } from "@/components/ui/field";
import { respondToInvitation } from "@/features/invitations/actions";
import { updateReminderPreference } from "@/features/reminders/actions";
import { TripForm } from "@/features/trips/trip-form";
import { formatDateRange, tripCountdown, tripDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams: Promise<{ invitationError?: string }>;
};

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
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader displayName={displayName} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Welcome, {displayName}
          </h1>
          <p className="text-muted-foreground">
            Create a trip and keep its planning details in one private
            workspace.
          </p>
        </div>

        {pendingInvitations?.length || invitationError || invitationsError ? (
          <section className="mt-8 rounded-2xl border border-primary/20 bg-accent p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-accent-foreground">
              <MailIcon className="size-4.5" />
              Trip invitations
            </h2>

            {invitationError || invitationsError ? (
              <Alert variant="destructive" className="mt-4 bg-destructive-muted">
                <AlertDescription>
                  {invitationError ?? "We could not load your invitations."}
                </AlertDescription>
              </Alert>
            ) : null}

            {pendingInvitations?.length ? (
              <ul className="mt-4 space-y-3">
                {pendingInvitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {invitation.trip_destination}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        You were invited to collaborate as the travel organizer.
                      </p>
                    </div>
                    <form action={respondToInvitation} className="flex gap-2">
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invitation.id}
                      />
                      <Button name="response" size="sm" value="accepted">
                        Accept
                      </Button>
                      <Button
                        name="response"
                        size="sm"
                        value="declined"
                        variant="outline"
                      >
                        Decline
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Your trips{" "}
              {trips?.length ? (
                <span className="text-muted-foreground tabular-nums">
                  ({trips.length})
                </span>
              ) : null}
            </h2>
          </div>

          {tripsError ? (
            <Alert variant="destructive" className="mt-4 bg-destructive-muted">
              <AlertDescription>
                We could not load your trips. Try refreshing the page.
              </AlertDescription>
            </Alert>
          ) : trips?.length ? (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => {
                const days = tripDuration(trip.start_date, trip.end_date);

                return (
                  <li key={trip.id}>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {tripCountdown(trip.start_date, trip.end_date, today)}
                        </span>
                        <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                        {trip.destination}
                      </h3>
                      <p className="mt-auto pt-3 text-sm text-muted-foreground">
                        {formatDateRange(trip.start_date, trip.end_date)}
                        {days ? ` · ${days} days` : ""}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty className="mt-4 rounded-2xl border border-dashed border-input">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinnedIcon />
                </EmptyMedia>
                <EmptyTitle>No trips yet</EmptyTitle>
                <EmptyDescription>
                  Create your first trip below to start planning.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <details open={!trips?.length} className="group/create">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold text-foreground">
              <PlusIcon className="size-4.5 text-primary transition-transform group-open/create:rotate-45" />
              Create a trip
            </summary>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start with the destination and dates. More planning tools live
              inside the trip.
            </p>
            <TripForm />
          </details>
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <BellIcon className="size-4.5 text-muted-foreground" />
            Email reminders
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Receive a reminder when an assigned task is due within the next
            three days.
          </p>
          <form
            action={updateReminderPreference}
            className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <FieldLabel htmlFor="taskRemindersEnabled">
              <input
                className="size-4 rounded-[4px] accent-primary"
                defaultChecked={profile?.task_reminders_enabled ?? true}
                id="taskRemindersEnabled"
                name="taskRemindersEnabled"
                type="checkbox"
              />
              Send task deadline reminders
            </FieldLabel>
            <Button size="sm" variant="outline">
              Save preference
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
