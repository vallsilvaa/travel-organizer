import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CommentThread, type ItemComment } from "@/features/comments/comment-thread";
import { deleteExpense } from "@/features/expenses/actions";
import { computeSettlements } from "@/features/expenses/balances";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { expenseCategoryLabels } from "@/features/expenses/validation";
import {
  cancelInvitation,
  resendInvitation,
} from "@/features/invitations/actions";
import { InviteForm } from "@/features/invitations/invite-form";
import { deleteItineraryItem } from "@/features/itinerary/actions";
import { ItineraryForm } from "@/features/itinerary/itinerary-form";
import { removeParticipant } from "@/features/participants/actions";
import { RealtimeStatus } from "@/features/realtime/realtime-status";
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
import { Badge } from "@/components/ui/badge";
import { ItemActionsMenu } from "@/components/item-actions-menu";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { SubmitButton } from "@/components/submit-button";
import { deleteTrip } from "@/features/trips/actions";
import { TripForm } from "@/features/trips/trip-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TripPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ category?: string; owner?: string; status?: string; tripError?: string }>;
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

type ExpenseShare = {
  expense_id: string;
  user_id: string;
  share_amount: string;
};

type ExpenseBalanceRow = {
  user_id: string;
  display_name: string;
  currency: string;
  total_paid: string;
  total_owed: string;
  net_balance: string;
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

const invitationStatusLabels: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  declined: "Recusado",
  cancelled: "Cancelado",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "Horário não definido";
}

function formatMoney(amount: number | string, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", {
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
    { data: expenseShares },
    { data: expenseBalances },
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
      supabase
        .from("trip_expense_shares")
        .select("expense_id, user_id, share_amount")
        .eq("trip_id", trip.id),
      supabase.rpc("get_trip_expense_balances", { requested_trip_id: trip.id }),
      isCreator
        ? supabase
            .from("trip_invitations")
            .select("id, email, status, created_at, expires_at")
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
  const sharesByExpense = new Map<string, ExpenseShare[]>();
  for (const share of (expenseShares ?? []) as ExpenseShare[]) {
    const shares = sharesByExpense.get(share.expense_id) ?? [];
    shares.push(share);
    sharesByExpense.set(share.expense_id, shares);
  }
  const totalsByCurrency = Array.from(
    tripExpenses.reduce((totals, expense) => {
      totals.set(
        expense.currency,
        (totals.get(expense.currency) ?? 0) + Number(expense.amount),
      );
      return totals;
    }, new Map<string, number>()),
  ).sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB));
  const balanceRows = (expenseBalances ?? []) as ExpenseBalanceRow[];
  // Balances come from every historical payer/ower, including participants
  // later removed from the trip, so this is a strictly richer name lookup
  // than the current-participants-only map above.
  const namesIncludingRemoved = new Map(participantNames);
  for (const row of balanceRows) {
    if (!namesIncludingRemoved.has(row.user_id)) {
      namesIncludingRemoved.set(row.user_id, row.display_name);
    }
  }
  const balancesByCurrency = new Map<string, ExpenseBalanceRow[]>();
  for (const row of balanceRows) {
    const rows = balancesByCurrency.get(row.currency) ?? [];
    rows.push(row);
    balancesByCurrency.set(row.currency, rows);
  }
  const settlements = computeSettlements(
    balanceRows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      currency: row.currency,
      totalPaid: row.total_paid,
      totalOwed: row.total_owed,
      netBalance: row.net_balance,
    })),
  );
  const settlementsByCurrency = new Map<string, typeof settlements>();
  for (const settlement of settlements) {
    const list = settlementsByCurrency.get(settlement.currency) ?? [];
    list.push(settlement);
    settlementsByCurrency.set(settlement.currency, list);
  }
  const commentsFor = (itemType: "itinerary" | "task", itemId: string) =>
    tripComments.filter((comment) =>
      itemType === "itinerary"
        ? comment.itinerary_item_id === itemId
        : comment.task_id === itemId,
    );
  const defaultTab = filters.status || filters.owner || filters.category ? "preparation" : "itinerary";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <Card className="[--card-spacing:--spacing(8)] sm:[--card-spacing:--spacing(10)]">
          <CardContent>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-primary hover:text-primary/80"
            >
              ← Voltar ao painel
            </Link>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Visão geral da viagem
              </p>
              <RealtimeStatus tripId={trip.id} />
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              {trip.destination}
            </h1>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5">
                <dt className="text-sm font-medium text-slate-500">Data de início</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDate(trip.start_date)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <dt className="text-sm font-medium text-slate-500">Data de término</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-950">
                  {trip.end_date ? formatDate(trip.end_date) : "Não definida"}
                </dd>
              </div>
            </dl>

            {filters.tripError === "delete_not_allowed" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                Somente quem criou a viagem pode excluí-la.
              </p>
            ) : null}

            {filters.tripError === "cannot_remove_self" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                Você não pode remover o seu próprio acesso a esta viagem.
              </p>
            ) : null}

            {filters.tripError === "remove_participant_not_allowed" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                Não foi possível remover esse participante.
              </p>
            ) : null}

            {filters.tripError === "resend_invitation_not_allowed" || filters.tripError === "cancel_invitation_not_allowed" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                Não foi possível atualizar esse convite. Ele pode já ter sido respondido ou cancelado.
              </p>
            ) : null}

            {isCreator ? (
              <div className="mt-8 border-t border-slate-200 pt-6">
                <details className="rounded-2xl bg-slate-50 p-5">
                  <summary className="cursor-pointer font-semibold text-slate-900">
                    Editar dados da viagem
                  </summary>
                  <TripForm trip={trip} />
                </details>
                <div className="mt-4 flex justify-end">
                  <ConfirmDeleteForm
                    action={deleteTrip}
                    hiddenFields={{ tripId: trip.id }}
                    title="Excluir esta viagem?"
                    description={`Essa ação removerá permanentemente ${trip.destination} e todos os seus itens, tarefas, despesas, comentários e convites.`}
                    triggerLabel="Excluir viagem"
                    triggerClassName="h-auto p-0 text-destructive"
                  />
                </div>
              </div>
            ) : null}

            {commentsError ? (
              <p role="alert" className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                Não foi possível carregar os comentários. O restante do conteúdo da viagem continua disponível.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="itinerary">Itinerário</TabsTrigger>
            <TabsTrigger value="expenses">Despesas</TabsTrigger>
            <TabsTrigger value="preparation">Preparação</TabsTrigger>
            {isCreator ? <TabsTrigger value="organizer">Organizador</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="itinerary">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl">Itinerário</CardTitle>
                  <CardDescription>
                    Mantenha atividades, reservas e pontos de encontro em ordem cronológica.
                  </CardDescription>
                </div>
                {itineraryItems?.length ? (
                  <a
                    href={`/api/trips/${trip.id}/itinerary.ics`}
                    download
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Exportar .ics
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <details className="mt-5 rounded-2xl bg-sky-50 p-5" open={!itineraryItems?.length}>
                <summary className="cursor-pointer font-semibold text-sky-900">
                  Adicionar item ao itinerário
                </summary>
                <div className="mt-5">
                  <ItineraryForm tripId={trip.id} />
                </div>
              </details>

              {itineraryError ? (
                <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  Não foi possível carregar o itinerário. Tente atualizar a página.
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
                        <ItemActionsMenu
                          editLabel="Editar item"
                          editForm={<ItineraryForm item={item} tripId={trip.id} />}
                          deleteAction={deleteItineraryItem}
                          deleteHiddenFields={{ tripId: trip.id, itemId: item.id }}
                          deleteTitle="Excluir item do itinerário?"
                          deleteDescription={`Isso vai remover permanentemente "${item.title}" do itinerário.`}
                        />
                      </div>
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
                  Nenhum item no itinerário ainda. Adicione a primeira atividade acima.
                </p>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="expenses">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle className="text-2xl">Despesas</CardTitle>
              <CardDescription>
                Registre custos compartilhados e veja os totais separados por moeda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalsByCurrency.length ? (
                <dl className="grid gap-3 sm:grid-cols-3">
                  {totalsByCurrency.map(([currency, total]) => (
                    <div key={currency} className="rounded-2xl bg-emerald-50 p-4">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total {currency}</dt>
                      <dd className="mt-1 text-xl font-semibold text-emerald-950">{formatMoney(total, currency)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {balancesByCurrency.size ? (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-950">Saldos</h3>
                  {Array.from(balancesByCurrency.entries()).map(([currency, rows]) => (
                    <div key={currency} className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{currency}</p>
                      <ul className="mt-3 space-y-2">
                        {rows.map((row) => {
                          const netCents = Math.round(Number(row.net_balance) * 100);
                          return (
                            <li key={row.user_id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700">{row.display_name}</span>
                              <span
                                className={
                                  netCents > 0
                                    ? "font-semibold text-emerald-700"
                                    : netCents < 0
                                      ? "font-semibold text-red-700"
                                      : "text-slate-500"
                                }
                              >
                                {netCents > 0
                                  ? `recebe ${formatMoney(row.net_balance, currency)}`
                                  : netCents < 0
                                    ? `deve ${formatMoney((-Number(row.net_balance)).toFixed(2), currency)}`
                                    : "quitado"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {(settlementsByCurrency.get(currency) ?? []).length ? (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sugestão de acerto</p>
                          <ul className="mt-2 space-y-1 text-sm text-slate-700">
                            {(settlementsByCurrency.get(currency) ?? []).map((settlement) => (
                              <li key={`${settlement.fromUserId}-${settlement.toUserId}`}>
                                {settlement.fromDisplayName} paga {formatMoney(settlement.amount, currency)} para {settlement.toDisplayName}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-500">Todo mundo está quitado.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <details className="mt-5 rounded-2xl bg-sky-50 p-5" open={!tripExpenses.length}>
                <summary className="cursor-pointer font-semibold text-sky-900">Adicionar despesa</summary>
                <div className="mt-5">
                  <ExpenseForm participants={tripParticipants} tripId={trip.id} />
                </div>
              </details>

              {expensesError ? (
                <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  Não foi possível carregar as despesas. Tente atualizar a página.
                </p>
              ) : tripExpenses.length ? (
                <ul className="mt-6 space-y-4">
                  {tripExpenses.map((expense) => (
                    <li key={expense.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-950">{expense.description}</h3>
                            <Badge variant="secondary" className="capitalize">
                              {expenseCategoryLabels[expense.category as keyof typeof expenseCategoryLabels] ?? expense.category}
                            </Badge>
                          </div>
                          <p className="mt-2 text-lg font-semibold text-emerald-800">{formatMoney(expense.amount, expense.currency)}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Pago por {namesIncludingRemoved.get(expense.payer_id) ?? "Viajante"} · {formatDate(expense.expense_date)}
                          </p>
                          {sharesByExpense.get(expense.id)?.length ? (
                            <p className="mt-2 text-sm text-slate-600">
                              Dividido: {sharesByExpense.get(expense.id)!
                                .map((share) => `${namesIncludingRemoved.get(share.user_id) ?? "Viajante"} ${formatMoney(share.share_amount, expense.currency)}`)
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        <ItemActionsMenu
                          editLabel="Editar despesa"
                          editForm={
                            <ExpenseForm
                              expense={expense}
                              existingShares={sharesByExpense.get(expense.id) ?? []}
                              participants={tripParticipants}
                              tripId={trip.id}
                            />
                          }
                          deleteAction={deleteExpense}
                          deleteHiddenFields={{ tripId: trip.id, expenseId: expense.id }}
                          deleteTitle="Excluir despesa?"
                          deleteDescription={`Isso vai remover permanentemente "${expense.description}" e seu valor do resumo por moeda.`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                  Nenhuma despesa ainda. Adicione o primeiro custo compartilhado acima.
                </p>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="preparation">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Antes do itinerário</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Preparação pré-viagem</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Complete documentos, reservas, dinheiro, saúde, conectividade e bagagem antes da partida.
                  </p>
                </div>
                <form action={addEnglandPreparationChecklist}>
                  <input type="hidden" name="tripId" value={trip.id} />
                  <SubmitButton pendingLabel="Adicionando checklist..." size="lg">Adicionar checklist da Inglaterra</SubmitButton>
                </form>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-sky-800">Prontidão para a viagem</p>
                    <p className="mt-1 text-3xl font-semibold text-sky-950">{readiness}%</p>
                  </div>
                  <p className="text-right text-sm text-sky-800">{completedTaskCount} de {allTasks.length} concluídas</p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white" aria-label={`${readiness}% pronto`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness}>
                  <div className="h-full rounded-full bg-sky-600" style={{ width: `${readiness}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-white">{criticalOpenCount} críticas em aberto</Badge>
                  <Badge variant="outline" className={overdueTaskCount ? "border-red-200 bg-red-100 text-red-800" : "bg-white"}>{overdueTaskCount} atrasadas</Badge>
                </div>
              </div>

              <details className="mt-5 rounded-2xl bg-slate-50 p-5" open={!allTasks.length}>
                <summary className="cursor-pointer font-semibold text-slate-900">Adicionar tarefa personalizada</summary>
                <div className="mt-5">
                  <TaskForm participants={tripParticipants} tripId={trip.id} />
                </div>
              </details>

              <form className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="status-filter" className="text-slate-700">Status</Label>
                  <Select name="status" defaultValue={statusFilter}>
                    <SelectTrigger id="status-filter" className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="open">Em aberto</SelectItem>
                      <SelectItem value="completed">Concluídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-filter" className="text-slate-700">Responsável</Label>
                  <Select name="owner" defaultValue={ownerFilter}>
                    <SelectTrigger id="owner-filter" className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os responsáveis</SelectItem>
                      <SelectItem value="unassigned">Sem responsável</SelectItem>
                      {tripParticipants.map((participant) => (
                        <SelectItem key={participant.user_id} value={participant.user_id}>{participant.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-filter" className="text-slate-700">Categoria</Label>
                  <Select name="category" defaultValue={categoryFilter}>
                    <SelectTrigger id="category-filter" className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {taskCategories.map((category) => (
                        <SelectItem key={category} value={category}>{taskCategoryLabels[category]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" variant="outline" className="sm:col-span-3 sm:justify-self-start">Aplicar filtros</Button>
              </form>

              {tasksError ? (
                <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar as tarefas de preparação. Tente atualizar a página.</p>
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
                                    {task.is_critical && !task.completed_at ? <Badge className="bg-amber-100 text-amber-900">Crítica</Badge> : null}
                                    {overdue ? <Badge className="bg-red-100 text-red-800">Atrasada</Badge> : null}
                                    {upcoming ? <Badge className="bg-sky-100 text-sky-800">Próxima</Badge> : null}
                                    {task.completed_at ? <Badge className="bg-emerald-100 text-emerald-800">Concluída</Badge> : null}
                                  </div>
                                  <p className="mt-2 text-sm text-slate-600">
                                    {participantNames.get(task.owner_id ?? "") ?? "Sem responsável"}
                                    {task.due_date ? ` · Prazo: ${formatDate(task.due_date)}` : " · Sem prazo"}
                                    {task.due_offset_days !== null ? ` · ${task.due_offset_days} dias antes da partida` : ""}
                                  </p>
                                  {task.reference_url ? (
                                    <a href={task.reference_url} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-800">
                                      {task.reference_label ?? "Abrir referência"} ↗
                                    </a>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  <form action={setTaskCompletion}>
                                    <input type="hidden" name="tripId" value={trip.id} />
                                    <input type="hidden" name="taskId" value={task.id} />
                                    <input type="hidden" name="completed" value={task.completed_at ? "false" : "true"} />
                                    <SubmitButton
                                      pendingLabel={task.completed_at ? "Reabrindo..." : "Concluindo..."}
                                      variant="outline"
                                      size="sm"
                                    >
                                      {task.completed_at ? "Reabrir" : "Concluir"}
                                    </SubmitButton>
                                  </form>
                                  <ItemActionsMenu
                                    editLabel="Editar tarefa"
                                    editForm={<TaskForm participants={tripParticipants} task={task} tripId={trip.id} />}
                                    deleteAction={deleteTask}
                                    deleteHiddenFields={{ tripId: trip.id, taskId: task.id }}
                                    deleteTitle="Remover esta tarefa de preparação?"
                                    deleteDescription={`Isso vai remover permanentemente "${task.title}" da sua lista de preparação.`}
                                    deleteLabel="Remover"
                                  />
                                </div>
                              </div>
                              <CommentThread comments={commentsFor("task", task.id)} currentUserId={user.id} itemId={task.id} itemType="task" participantNames={participantNames} tripId={trip.id} />
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">Nenhuma tarefa de preparação corresponde a esses filtros. Adicione o checklist da Inglaterra ou crie uma tarefa personalizada.</p>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          {isCreator ? (
            <TabsContent value="organizer">
              <Card className="[--card-spacing:--spacing(6)]">
                <CardHeader>
                  <CardTitle className="text-xl">Organizador da viagem</CardTitle>
                  <CardDescription>
                    Convide um organizador por e-mail. A pessoa pode aceitar após entrar com o mesmo endereço.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-b border-slate-200 pb-8">
                    <h3 className="text-lg font-semibold text-slate-950">Participantes</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Veja quem tem acesso a esta viagem e remova organizadores quando necessário.
                    </p>
                    <ul className="mt-5 divide-y divide-slate-200 border-t border-slate-200">
                      {tripParticipants.map((participant) => {
                        const isTripCreator = participant.user_id === trip.created_by;
                        return (
                          <li
                            key={participant.user_id}
                            className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {participant.display_name}
                              </p>
                              <Badge variant="outline" className="mt-1">
                                {isTripCreator ? "Criador(a) da viagem" : "Organizador(a)"}
                              </Badge>
                            </div>
                            {!isTripCreator ? (
                              <ConfirmDeleteForm
                                action={removeParticipant}
                                hiddenFields={{ tripId: trip.id, userId: participant.user_id }}
                                title="Remover este organizador?"
                                description={`${participant.display_name} perderá acesso imediato a esta viagem.`}
                                triggerLabel="Remover acesso"
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="mt-8">
                  <InviteForm tripId={trip.id} />

                  {invitations?.length ? (
                    <ul className="mt-6 divide-y divide-slate-200 border-t border-slate-200">
                      {invitations.map((invitation) => (
                        <li
                          key={invitation.id}
                          className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <span className="text-sm font-medium text-slate-800">
                              {invitation.email}
                            </span>
                            {invitation.status === "pending" ? (
                              <p className="text-xs text-slate-500">
                                Expira em {formatDate(invitation.expires_at.slice(0, 10))}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                invitation.status === "accepted"
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                                  : invitation.status === "declined"
                                    ? "border-red-200 bg-red-100 text-red-800"
                                    : invitation.status === "cancelled"
                                      ? "border-slate-200 bg-slate-100 text-slate-600"
                                      : ""
                              }
                            >
                              {invitationStatusLabels[invitation.status] ?? invitation.status}
                            </Badge>
                            {invitation.status === "pending" ? (
                              <>
                                <form action={resendInvitation}>
                                  <input type="hidden" name="tripId" value={trip.id} />
                                  <input type="hidden" name="invitationId" value={invitation.id} />
                                  <SubmitButton
                                    pendingLabel="Reenviando..."
                                    variant="outline"
                                    size="sm"
                                  >
                                    Reenviar
                                  </SubmitButton>
                                </form>
                                <ConfirmDeleteForm
                                  action={cancelInvitation}
                                  hiddenFields={{ tripId: trip.id, invitationId: invitation.id }}
                                  title="Cancelar este convite?"
                                  description={`O convite para ${invitation.email} não poderá mais ser aceito.`}
                                  triggerLabel="Cancelar"
                                  triggerClassName="h-auto p-0 text-destructive text-sm"
                                />
                              </>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </main>
  );
}
