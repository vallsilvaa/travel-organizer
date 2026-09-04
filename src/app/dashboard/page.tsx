import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { changePassword, signOut, updateDisplayName } from "@/features/auth/actions";
import { respondToInvitation } from "@/features/invitations/actions";
import { getInvitationRoleLabels } from "@/features/invitations/validation";
import { getAuthMessage } from "@/features/auth/messages";
import { NotificationBell, type Notification } from "@/features/notifications/notification-bell";
import { updateReminderPreference } from "@/features/reminders/actions";
import { TripForm } from "@/features/trips/trip-form";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { todayInTimeZone } from "@/lib/timezone";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardPageProps = {
  searchParams: Promise<{
    invitationError?: string;
    passwordError?: string;
    passwordMessage?: string;
    profileError?: string;
    profileMessage?: string;
    q?: string;
    status?: string;
    sort?: string;
  }>;
};

type Trip = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string | null;
  updated_at: string;
  archived_at: string | null;
  timezone: string;
};

type DashboardTripStats = {
  trip_id: string;
  readiness_percentage: number;
  critical_open_count: number;
  participant_count: number;
};

type TripStatus = "upcoming" | "active" | "completed" | "archived";

const statusFilters = ["all", "upcoming", "active", "completed", "archived"] as const;
type StatusFilter = (typeof statusFilters)[number];

const sortOptions = ["date", "recent"] as const;
type SortOption = (typeof sortOptions)[number];

function tripStatus(trip: Trip): TripStatus {
  if (trip.archived_at) {
    return "archived";
  }
  const today = todayInTimeZone(trip.timezone);
  const endDate = trip.end_date ?? trip.start_date;
  if (today < trip.start_date) {
    return "upcoming";
  }
  if (today > endDate) {
    return "completed";
  }
  return "active";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const t = await getTranslations("dashboard");
  const invitationRoleLabels = getInvitationRoleLabels(await getTranslations("categories.invitationRole"));
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const formatDate = (value: string) => format.dateTime(new Date(`${value}T00:00:00Z`), "medium");
  const statusFilterLabels: Record<StatusFilter, string> = {
    all: t("statusFilters.all"),
    upcoming: t("statusFilters.upcoming"),
    active: t("statusFilters.active"),
    completed: t("statusFilters.completed"),
    archived: t("statusFilters.archived"),
  };
  const sortLabels: Record<SortOption, string> = {
    date: t("sortOptions.date"),
    recent: t("sortOptions.recent"),
  };
  const tripStatusLabels: Record<TripStatus, string> = {
    upcoming: t("tripStatus.upcoming"),
    active: t("tripStatus.active"),
    completed: t("tripStatus.completed"),
    archived: t("tripStatus.archived"),
  };
  const [profileError, profileMessage, passwordError, passwordMessage] = await Promise.all([
    getAuthMessage(params.profileError),
    getAuthMessage(params.profileMessage),
    getAuthMessage(params.passwordError),
    getAuthMessage(params.passwordMessage),
  ]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const [{ data: profile }, { data: trips, error: tripsError }, { data: notifications }, { data: tripStats }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, task_reminders_enabled")
        .eq("id", user.id)
        .single(),
      supabase
        .from("trips")
        .select("id, destination, start_date, end_date, updated_at, archived_at, timezone"),
      supabase
        .from("notifications")
        .select("id, notification_type, title, body, link_path, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.rpc("get_dashboard_trip_stats"),
    ]);
  const tripStatsByTripId = new Map(
    ((tripStats ?? []) as DashboardTripStats[]).map((stats) => [stats.trip_id, stats]),
  );

  const displayName = profile?.display_name ?? user.email ?? tCommon("traveler");
  const { data: pendingInvitations, error: invitationsError } = user.email
    ? await supabase
        .from("trip_invitations")
        .select("id, trip_id, trip_destination, status, role, created_at")
        .eq("status", "pending")
        .eq("email", user.email.toLowerCase())
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const invitationError = params.invitationError ? t("invitations.unavailable") : null;

  const searchTerm = (params.q ?? "").trim().toLowerCase();
  const statusFilter: StatusFilter = statusFilters.includes(params.status as StatusFilter)
    ? (params.status as StatusFilter)
    : "all";
  const sortOption: SortOption = sortOptions.includes(params.sort as SortOption)
    ? (params.sort as SortOption)
    : "date";
  const allTrips = (trips ?? []) as Trip[];
  const filteredTrips = allTrips
    .filter((trip) => trip.destination.toLowerCase().includes(searchTerm))
    .filter((trip) => {
      const status = tripStatus(trip);
      return statusFilter === "all" ? status !== "archived" : status === statusFilter;
    })
    .sort((a, b) =>
      sortOption === "recent"
        ? b.updated_at.localeCompare(a.updated_at)
        : a.start_date.localeCompare(b.start_date),
    );
  const hasActiveFilters = Boolean(searchTerm) || statusFilter !== "all" || sortOption !== "date";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {tCommon("appName")}
            </p>
            <CardTitle className="mt-2 text-3xl">{t("welcome", { name: displayName })}</CardTitle>
            <CardDescription className="mt-2 text-base">
              {t("welcomeDescription")}
            </CardDescription>
            <CardAction className="flex items-center gap-3">
              <Link href="/organizer" className="text-sm font-semibold text-primary hover:text-primary/80">
                {t("organizerPanelLink")}
              </Link>
              <LanguageSwitcher />
              <ThemeToggle />
              <NotificationBell notifications={(notifications ?? []) as Notification[]} />
              <form action={signOut}>
                <SubmitButton pendingLabel={t("signOutPending")} variant="outline">{t("signOut")}</SubmitButton>
              </form>
            </CardAction>
          </CardHeader>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">{t("editProfile.title")}</CardTitle>
            <CardDescription>
              {t("editProfile.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profileError ? (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {profileError}
              </p>
            ) : null}
            {profileMessage ? (
              <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                {profileMessage}
              </p>
            ) : null}
            <form action={updateDisplayName} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="displayName">{t("editProfile.displayNameLabel")}</Label>
                <Input
                  required
                  minLength={2}
                  maxLength={100}
                  id="displayName"
                  name="displayName"
                  defaultValue={displayName}
                />
              </div>
              <SubmitButton pendingLabel={t("editProfile.savePending")} variant="outline">{t("editProfile.save")}</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">{t("reminders.title")}</CardTitle>
            <CardDescription>
              {t("reminders.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={updateReminderPreference}
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  name="taskRemindersEnabled"
                  defaultChecked={profile?.task_reminders_enabled ?? true}
                  className="h-5 w-5 rounded border-input accent-primary"
                />
                {t("reminders.checkboxLabel")}
              </label>
              <SubmitButton pendingLabel={t("reminders.savePending")} variant="outline">{t("reminders.save")}</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">{t("changePassword.title")}</CardTitle>
            <CardDescription>
              {t("changePassword.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {passwordError ? (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {passwordError}
              </p>
            ) : null}
            {passwordMessage ? (
              <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                {passwordMessage}
              </p>
            ) : null}
            <form action={changePassword} className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="password">{t("changePassword.newPassword")}</Label>
                <Input required autoComplete="new-password" id="password" name="password" type="password" minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirmation">{t("changePassword.confirmPassword")}</Label>
                <Input required autoComplete="new-password" id="passwordConfirmation" name="passwordConfirmation" type="password" minLength={8} />
              </div>
              <SubmitButton pendingLabel={t("changePassword.savePending")} variant="outline" className="sm:col-span-2 sm:justify-self-start">
                {t("changePassword.save")}
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {pendingInvitations?.length || invitationError || invitationsError ? (
          <Card className="border-sky-200 bg-sky-50 [--card-spacing:--spacing(8)]">
            <CardHeader>
              <CardTitle className="text-2xl">{t("invitations.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {invitationError || invitationsError ? (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {invitationError ?? t("invitations.loadError")}
                </p>
              ) : null}
              {pendingInvitations?.length ? (
                <ul className="mt-5 space-y-3">
                  {pendingInvitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="rounded-2xl border border-sky-200 bg-card p-5"
                    >
                      <p className="font-semibold text-slate-950">
                        {invitation.trip_destination}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {t("invitations.invitedAsRole", {
                          role: invitationRoleLabels[invitation.role as keyof typeof invitationRoleLabels] ?? invitation.role,
                        })}
                      </p>
                      <form action={respondToInvitation} className="mt-4 flex gap-3">
                        <input
                          type="hidden"
                          name="invitationId"
                          value={invitation.id}
                        />
                        <SubmitButton pendingLabel={t("invitations.respondPending")} name="response" value="accepted">
                          {t("invitations.accept")}
                        </SubmitButton>
                        <SubmitButton pendingLabel={t("invitations.respondPending")} name="response" value="declined" variant="outline">
                          {t("invitations.decline")}
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-2xl">{t("createTrip.title")}</CardTitle>
            <CardDescription>
              {t("createTrip.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TripForm />
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-2xl">{t("yourTrips.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {allTrips.length ? (
              <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="q" className="text-slate-700">{t("yourTrips.destinationLabel")}</Label>
                  <Input
                    id="q"
                    name="q"
                    defaultValue={params.q}
                    placeholder={t("yourTrips.destinationPlaceholder")}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status-filter" className="text-slate-700">{t("yourTrips.statusLabel")}</Label>
                  <Select name="status" defaultValue={statusFilter} items={statusFilterLabels}>
                    <SelectTrigger id="status-filter" className="w-full bg-white sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusFilters.map((value) => (
                        <SelectItem key={value} value={value}>{statusFilterLabels[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sort-option" className="text-slate-700">{t("yourTrips.sortLabel")}</Label>
                  <Select name="sort" defaultValue={sortOption} items={sortLabels}>
                    <SelectTrigger id="sort-option" className="w-full bg-white sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((value) => (
                        <SelectItem key={value} value={value}>{sortLabels[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit">{t("yourTrips.search")}</Button>
                {hasActiveFilters ? (
                  <Link
                    href="/dashboard"
                    className="text-sm font-semibold text-primary hover:text-primary/80"
                  >
                    {t("yourTrips.clearFilters")}
                  </Link>
                ) : null}
              </form>
            ) : null}

            {tripsError ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("yourTrips.loadError")}
              </p>
            ) : filteredTrips.length ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {filteredTrips.map((trip) => {
                  const status = tripStatus(trip);
                  const stats = tripStatsByTripId.get(trip.id);
                  return (
                    <li key={trip.id}>
                      <Link
                        href={`/trips/${trip.id}`}
                        className={`block h-full rounded-2xl border p-5 transition hover:border-sky-300 hover:bg-sky-50 ${
                          status === "archived"
                            ? "border-dashed border-slate-300 bg-slate-50"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`text-lg font-semibold ${status === "archived" ? "text-slate-500" : "text-slate-950"}`}>
                            {trip.destination}
                          </h3>
                          <Badge variant="outline" className="shrink-0 capitalize">
                            {tripStatusLabels[status]}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {formatDate(trip.start_date)}
                          {trip.end_date ? ` – ${formatDate(trip.end_date)}` : ""}
                        </p>
                        {stats ? (
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span>{t("yourTrips.readiness", { percent: stats.readiness_percentage })}</span>
                            <span aria-hidden="true">·</span>
                            <span className={stats.critical_open_count ? "font-semibold text-amber-800" : undefined}>
                              {t("yourTrips.criticalOpen", { count: stats.critical_open_count })}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {t("yourTrips.participants", { count: stats.participant_count })}
                            </span>
                          </div>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : allTrips.length ? (
              <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                {t("yourTrips.noResults")}{" "}
                <Link href="/dashboard" className="font-semibold text-primary hover:text-primary/80">
                  {t("yourTrips.clearFilters")}
                </Link>
              </p>
            ) : (
              <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                {t("yourTrips.empty")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
