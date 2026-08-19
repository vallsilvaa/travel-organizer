import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  SquareCheckBigIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { StatTile } from "@/components/layout/stat-tile";
import { TabNav, type TabItem } from "@/components/layout/tab-nav";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExpensesSection } from "@/features/expenses/expenses-section";
import { PeopleSection } from "@/features/invitations/people-section";
import { ItinerarySection } from "@/features/itinerary/itinerary-section";
import { TasksSection } from "@/features/tasks/tasks-section";
import { taskCategories, type TaskCategory } from "@/features/tasks/templates";
import { TripOverview } from "@/features/trips/trip-overview";
import type {
  ItineraryItem,
  TripComment,
  TripExpense,
  TripInvitation,
  TripParticipant,
  TripTask,
} from "@/features/trips/types";
import { formatDateRange, formatMoney, tripCountdown, tripDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type TripPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{
    category?: string;
    owner?: string;
    status?: string;
    tab?: string;
  }>;
};

const tabKeys = ["overview", "itinerary", "tasks", "expenses", "people"] as const;
type TabKey = (typeof tabKeys)[number];

export default async function TripPage({ params, searchParams }: TripPageProps) {
  const [{ tripId }, filters] = await Promise.all([params, searchParams]);
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
  const activeTab: TabKey = tabKeys.includes(filters.tab as TabKey)
    ? (filters.tab as TabKey)
    : "overview";
  const statusFilter = filters.status === "completed" || filters.status === "open"
    ? filters.status
    : "all";
  const ownerFilter = filters.owner ?? "all";
  const categoryFilter = taskCategories.includes(filters.category as TaskCategory)
    ? filters.category as TaskCategory
    : "all";

  const [
    { data: itineraryItems, error: itineraryError },
    { data: tasks, error: tasksError },
    { data: participants },
    { data: comments, error: commentsError },
    { data: expenses, error: expensesError },
    invitationResult,
  ] =
    await Promise.all([
      supabase
        .from("itinerary_items")
        .select("id, item_date, start_time, title, location, notes")
        .eq("trip_id", trip.id)
        .order("item_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false }),
      supabase
        .from("trip_tasks")
        .select("id, title, owner_id, due_date, due_offset_days, completed_at, created_at, category, is_critical, template_key, reference_label, reference_url")
        .eq("trip_id", trip.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase.rpc("get_trip_participants", { requested_trip_id: trip.id }),
      supabase
        .from("item_comments")
        .select("id, item_type, itinerary_item_id, task_id, body, author_id, created_at, updated_at")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("trip_expenses")
        .select("id, description, amount, currency, category, expense_date, payer_id")
        .eq("trip_id", trip.id)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      isCreator
        ? supabase
            .from("trip_invitations")
            .select("id, email, status, created_at")
            .eq("trip_id", trip.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  const invitations = (invitationResult.data ?? []) as TripInvitation[];
  const tripParticipants = (participants ?? []) as TripParticipant[];
  const participantNames = new Map<string, string>(
    tripParticipants.map((participant) => [
      participant.user_id,
      participant.display_name,
    ]),
  );
  const today = new Date().toISOString().slice(0, 10);
  const tripItinerary = (itineraryItems ?? []) as ItineraryItem[];
  const allTasks = (tasks ?? []) as TripTask[];
  const filteredTasks = allTasks.filter((task) => {
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "completed" ? Boolean(task.completed_at) : !task.completed_at);
    const matchesOwner = ownerFilter === "all"
      || (ownerFilter === "unassigned" ? !task.owner_id : task.owner_id === ownerFilter);
    const matchesCategory = categoryFilter === "all" || task.category === categoryFilter;
    return matchesStatus && matchesOwner && matchesCategory;
  });
  const completedTaskCount = allTasks.filter((task) => task.completed_at).length;
  const readiness = allTasks.length
    ? Math.round((completedTaskCount / allTasks.length) * 100)
    : 0;
  const criticalOpenCount = allTasks.filter((task) => task.is_critical && !task.completed_at).length;
  const overdueTaskCount = allTasks.filter((task) => !task.completed_at && task.due_date && task.due_date < today).length;
  const tasksByCategory = taskCategories
    .map((category) => ({
      category,
      tasks: filteredTasks.filter((task) => task.category === category),
    }))
    .filter((group) => group.tasks.length);
  const tripComments = (comments ?? []) as TripComment[];
  const tripExpenses = (expenses ?? []) as TripExpense[];
  const totalsByCurrency = Array.from(
    tripExpenses.reduce((totals, expense) => {
      totals.set(
        expense.currency,
        (totals.get(expense.currency) ?? 0) + Number(expense.amount),
      );
      return totals;
    }, new Map<string, number>()),
  ).sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB));
  const commentsFor = (itemType: "itinerary" | "task", itemId: string) =>
    tripComments.filter((comment) =>
      itemType === "itinerary"
        ? comment.itinerary_item_id === itemId
        : comment.task_id === itemId,
    );

  const [primaryCurrency, primaryTotal] = totalsByCurrency[0] ?? [];
  const days = tripDuration(trip.start_date, trip.end_date);
  const sectionProps = {
    commentsFor,
    currentUserId: user.id,
    participantNames,
    participants: tripParticipants,
    tripId: trip.id,
  };
  const tabs: TabItem[] = [
    {
      href: `/trips/${trip.id}`,
      icon: LayoutDashboardIcon,
      key: "overview",
      label: "Overview",
    },
    {
      count: tripItinerary.length,
      href: `/trips/${trip.id}?tab=itinerary`,
      icon: CalendarDaysIcon,
      key: "itinerary",
      label: "Itinerary",
    },
    {
      count: allTasks.length,
      href: `/trips/${trip.id}?tab=tasks`,
      icon: SquareCheckBigIcon,
      key: "tasks",
      label: "Tasks",
    },
    {
      count: tripExpenses.length,
      href: `/trips/${trip.id}?tab=expenses`,
      icon: ReceiptTextIcon,
      key: "expenses",
      label: "Expenses",
    },
    {
      count: tripParticipants.length,
      href: `/trips/${trip.id}?tab=people`,
      icon: UsersIcon,
      key: "people",
      label: "People",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader
        displayName={participantNames.get(user.id) ?? user.email ?? "Traveler"}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Button asChild size="sm" variant="ghost" className="-ml-2.5">
          <Link href="/dashboard">
            <ChevronLeftIcon />
            Back to trips
          </Link>
        </Button>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {trip.destination}
          </h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {tripCountdown(trip.start_date, trip.end_date, today)}
          </span>
        </div>
        <p className="mt-2 text-muted-foreground">
          {formatDateRange(trip.start_date, trip.end_date)}
          {days ? ` · ${days} days` : ""}
          {` · ${tripParticipants.length} ${tripParticipants.length === 1 ? "traveler" : "travelers"}`}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            hint={`${completedTaskCount} of ${allTasks.length} tasks`}
            icon={GaugeIcon}
            label="Readiness"
            tone="primary"
            value={`${readiness}%`}
          />
          <StatTile
            hint="Before departure"
            icon={AlertTriangleIcon}
            label="Critical open"
            tone={criticalOpenCount ? "warning" : "default"}
            value={String(criticalOpenCount)}
          />
          <StatTile
            hint="Past their due date"
            icon={SquareCheckBigIcon}
            label="Overdue"
            tone={overdueTaskCount ? "destructive" : "default"}
            value={String(overdueTaskCount)}
          />
          <StatTile
            hint={
              totalsByCurrency.length > 1
                ? `+${totalsByCurrency.length - 1} more currency`
                : "Recorded so far"
            }
            icon={WalletIcon}
            label="Spend"
            tone="success"
            value={
              primaryCurrency ? formatMoney(primaryTotal, primaryCurrency) : "—"
            }
          />
        </div>

        {commentsError ? (
          <Alert variant="destructive" className="mt-6 bg-destructive-muted">
            <AlertDescription>
              Comments could not be loaded. Other trip content is still
              available.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-8">
          <TabNav activeKey={activeTab} items={tabs} />
        </div>

        <div className="mt-6">
          {activeTab === "overview" ? (
            <TripOverview
              completedTaskCount={completedTaskCount}
              itineraryItems={tripItinerary}
              readiness={readiness}
              tasks={allTasks}
              today={today}
              tripId={trip.id}
            />
          ) : null}

          {activeTab === "itinerary" ? (
            <ItinerarySection
              {...sectionProps}
              error={Boolean(itineraryError)}
              items={tripItinerary}
            />
          ) : null}

          {activeTab === "tasks" ? (
            <TasksSection
              {...sectionProps}
              categoryFilter={categoryFilter}
              error={Boolean(tasksError)}
              hasAnyTask={allTasks.length > 0}
              ownerFilter={ownerFilter}
              statusFilter={statusFilter}
              tasksByCategory={tasksByCategory}
              today={today}
            />
          ) : null}

          {activeTab === "expenses" ? (
            <ExpensesSection
              {...sectionProps}
              error={Boolean(expensesError)}
              expenses={tripExpenses}
              totalsByCurrency={totalsByCurrency}
            />
          ) : null}

          {activeTab === "people" ? (
            <PeopleSection
              invitations={invitations}
              isCreator={isCreator}
              participants={tripParticipants}
              tripId={trip.id}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
