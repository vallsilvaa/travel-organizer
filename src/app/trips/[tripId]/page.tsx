import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CommentThread, type ItemComment } from "@/features/comments/comment-thread";
import { deleteExpense } from "@/features/expenses/actions";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { InviteForm } from "@/features/invitations/invite-form";
import { deleteItineraryItem } from "@/features/itinerary/actions";
import { ItineraryForm } from "@/features/itinerary/itinerary-form";
import {
  addEnglandPreparationChecklist,
  deleteTask,
  setTaskCompletion,
} from "@/features/tasks/actions";
import { TaskForm } from "@/features/tasks/task-form";
import {
  taskCategories,
  taskCategoryLabels,
  type TaskCategory,
} from "@/features/tasks/templates";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

type TripPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ category?: string; owner?: string; status?: string }>;
};

type TripParticipant = {
  user_id: string;
  display_name: string;
  role: string;
};

type TripComment = ItemComment & {
  item_type: "itinerary" | "task";
  itinerary_item_id: string | null;
  task_id: string | null;
};

type TripExpense = {
  id: string;
  description: string;
  amount: string;
  currency: string;
  category: string;
  expense_date: string;
  payer_id: string;
};

type TripTask = {
  id: string;
  title: string;
  owner_id: string | null;
  due_date: string | null;
  due_offset_days: number | null;
  completed_at: string | null;
  created_at: string;
  category: TaskCategory;
  is_critical: boolean;
  template_key: string | null;
  reference_label: string | null;
  reference_url: string | null;
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

function formatMoney(amount: number | string, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

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
  const invitations = invitationResult.data;
  const tripParticipants = (participants ?? []) as TripParticipant[];
  const participantNames = new Map<string, string>(
    tripParticipants.map((participant) => [
      participant.user_id,
      participant.display_name,
    ]),
  );
  const today = new Date().toISOString().slice(0, 10);
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

        {commentsError ? (
          <p role="alert" className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            Comments could not be loaded. Other trip content is still available.
          </p>
        ) : null}

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
                      <Button variant="link" className="h-auto p-0 text-destructive">
                        Delete
                      </Button>
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
                  <CommentThread
                    comments={commentsFor("itinerary", item.id)}
                    currentUserId={user.id}
                    itemId={item.id}
                    itemType="itinerary"
                    participantNames={participantNames}
                    tripId={trip.id}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              No itinerary items yet. Add the first activity above.
            </p>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold text-slate-950">Expenses</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Record shared costs and review totals separately for each currency.
          </p>

          {totalsByCurrency.length ? (
            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              {totalsByCurrency.map(([currency, total]) => (
                <div key={currency} className="rounded-2xl bg-emerald-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total {currency}</dt>
                  <dd className="mt-1 text-xl font-semibold text-emerald-950">{formatMoney(total, currency)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <details className="mt-5 rounded-2xl bg-sky-50 p-5" open={!tripExpenses.length}>
            <summary className="cursor-pointer font-semibold text-sky-900">Add expense</summary>
            <div className="mt-5">
              <ExpenseForm participants={tripParticipants} tripId={trip.id} />
            </div>
          </details>

          {expensesError ? (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              We could not load the expenses. Try refreshing the page.
            </p>
          ) : tripExpenses.length ? (
            <ul className="mt-6 space-y-4">
              {tripExpenses.map((expense) => (
                <li key={expense.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">{expense.description}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">{expense.category}</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-emerald-800">{formatMoney(expense.amount, expense.currency)}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Paid by {participantNames.get(expense.payer_id) ?? "Traveler"} · {formatDate(expense.expense_date)}
                      </p>
                    </div>
                    <form action={deleteExpense}>
                      <input type="hidden" name="tripId" value={trip.id} />
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <Button variant="link" className="h-auto p-0 text-destructive">Delete</Button>
                    </form>
                  </div>
                  <details className="mt-4 border-t border-slate-200 pt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-sky-700">Edit expense</summary>
                    <div className="mt-4">
                      <ExpenseForm expense={expense} participants={tripParticipants} tripId={trip.id} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              No expenses yet. Add the first shared cost above.
            </p>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Before the itinerary</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Pre-trip preparation</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Complete documents, bookings, money, health, connectivity, and packing before departure.
              </p>
            </div>
            <form action={addEnglandPreparationChecklist}>
              <input type="hidden" name="tripId" value={trip.id} />
              <Button size="lg">Add England checklist</Button>
            </form>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-sky-800">Travel readiness</p>
                <p className="mt-1 text-3xl font-semibold text-sky-950">{readiness}%</p>
              </div>
              <p className="text-right text-sm text-sky-800">{completedTaskCount} of {allTasks.length} completed</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white" aria-label={`${readiness}% ready`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness}>
              <div className="h-full rounded-full bg-sky-600" style={{ width: `${readiness}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-white px-3 py-1.5 text-slate-700">{criticalOpenCount} critical open</span>
              <span className={`rounded-full px-3 py-1.5 ${overdueTaskCount ? "bg-red-100 text-red-800" : "bg-white text-slate-700"}`}>{overdueTaskCount} overdue</span>
            </div>
          </div>

          <details className="mt-5 rounded-2xl bg-slate-50 p-5" open={!allTasks.length}>
            <summary className="cursor-pointer font-semibold text-slate-900">Add a custom preparation task</summary>
            <div className="mt-5">
              <TaskForm participants={tripParticipants} tripId={trip.id} />
            </div>
          </details>

          <form className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Status
              <select name="status" defaultValue={statusFilter} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Owner
              <select name="owner" defaultValue={ownerFilter} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                <option value="all">All owners</option>
                <option value="unassigned">Unassigned</option>
                {tripParticipants.map((participant) => <option key={participant.user_id} value={participant.user_id}>{participant.display_name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Category
              <select name="category" defaultValue={categoryFilter} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                <option value="all">All categories</option>
                {taskCategories.map((category) => <option key={category} value={category}>{taskCategoryLabels[category]}</option>)}
              </select>
            </label>
            <Button type="submit" variant="outline" className="sm:col-span-3 sm:justify-self-start">Apply filters</Button>
          </form>

          {tasksError ? (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">We could not load preparation tasks. Try refreshing the page.</p>
          ) : tasksByCategory.length ? (
            <div className="mt-7 space-y-8">
              {tasksByCategory.map((group) => (
                <section key={group.category}>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{taskCategoryLabels[group.category]}</h3>
                  <ul className="mt-3 space-y-4">
                    {group.tasks.map((task) => {
                      const overdue = !task.completed_at && task.due_date && task.due_date < today;
                      const upcoming = !task.completed_at && task.due_date && task.due_date >= today;
                      return (
                        <li key={task.id} className={`rounded-2xl border p-5 ${task.completed_at ? "border-slate-200 bg-slate-50" : overdue ? "border-red-200 bg-red-50" : upcoming ? "border-sky-200 bg-sky-50" : "border-slate-200"}`}>
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className={`font-semibold ${task.completed_at ? "text-slate-500 line-through" : "text-slate-950"}`}>{task.title}</h4>
                                {task.is_critical && !task.completed_at ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Critical</span> : null}
                                {overdue ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">Overdue</span> : null}
                                {upcoming ? <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">Upcoming</span> : null}
                                {task.completed_at ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Completed</span> : null}
                              </div>
                              <p className="mt-2 text-sm text-slate-600">
                                {participantNames.get(task.owner_id ?? "") ?? "Unassigned"}
                                {task.due_date ? ` · Due ${formatDate(task.due_date)}` : " · No deadline"}
                                {task.due_offset_days !== null ? ` · ${task.due_offset_days} days before departure` : ""}
                              </p>
                              {task.reference_url ? (
                                <a href={task.reference_url} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-800">
                                  {task.reference_label ?? "Open supporting reference"} ↗
                                </a>
                              ) : null}
                            </div>
                            <form action={setTaskCompletion}>
                              <input type="hidden" name="tripId" value={trip.id} />
                              <input type="hidden" name="taskId" value={task.id} />
                              <input type="hidden" name="completed" value={task.completed_at ? "false" : "true"} />
                              <Button variant="outline" size="sm">{task.completed_at ? "Reopen" : "Complete"}</Button>
                            </form>
                          </div>
                          <details className="mt-4 border-t border-slate-200 pt-4">
                            <summary className="cursor-pointer text-sm font-semibold text-sky-700">Edit or remove</summary>
                            <div className="mt-4"><TaskForm participants={tripParticipants} task={task} tripId={trip.id} /></div>
                            <form action={deleteTask} className="mt-4">
                              <input type="hidden" name="tripId" value={trip.id} />
                              <input type="hidden" name="taskId" value={task.id} />
                              <Button variant="link" className="h-auto p-0 text-destructive">Remove this preparation task</Button>
                            </form>
                          </details>
                          <CommentThread comments={commentsFor("task", task.id)} currentUserId={user.id} itemId={task.id} itemType="task" participantNames={participantNames} tripId={trip.id} />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">No preparation tasks match these filters. Add the England checklist or create a custom task.</p>
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

      </section>
    </main>
  );
}
