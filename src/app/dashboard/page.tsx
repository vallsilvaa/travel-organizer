import Link from "next/link";
import { redirect } from "next/navigation";

import { changePassword, signOut, updateDisplayName } from "@/features/auth/actions";
import { respondToInvitation } from "@/features/invitations/actions";
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
import { SubmitButton } from "@/components/submit-button";
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
};

type TripStatus = "upcoming" | "active" | "completed" | "archived";

const statusFilters = ["all", "upcoming", "active", "completed", "archived"] as const;
type StatusFilter = (typeof statusFilters)[number];

const statusFilterLabels: Record<StatusFilter, string> = {
  all: "Ativas",
  upcoming: "Futuras",
  active: "Em andamento",
  completed: "Concluídas",
  archived: "Arquivadas",
};

const sortOptions = ["date", "recent"] as const;
type SortOption = (typeof sortOptions)[number];

const sortLabels: Record<SortOption, string> = {
  date: "Data da viagem",
  recent: "Atividade recente",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function tripStatus(trip: Trip, today: string): TripStatus {
  if (trip.archived_at) {
    return "archived";
  }
  const endDate = trip.end_date ?? trip.start_date;
  if (today < trip.start_date) {
    return "upcoming";
  }
  if (today > endDate) {
    return "completed";
  }
  return "active";
}

const tripStatusLabels: Record<TripStatus, string> = {
  upcoming: "futura",
  active: "em andamento",
  completed: "concluída",
  archived: "arquivada",
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

  const [{ data: profile }, { data: trips, error: tripsError }, { data: notifications }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, task_reminders_enabled")
        .eq("id", user.id)
        .single(),
      supabase
        .from("trips")
        .select("id, destination, start_date, end_date, updated_at, archived_at"),
      supabase
        .from("notifications")
        .select("id, notification_type, title, body, link_path, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const displayName = profile?.display_name ?? user.email ?? "Viajante";
  const { data: pendingInvitations, error: invitationsError } = user.email
    ? await supabase
        .from("trip_invitations")
        .select("id, trip_id, trip_destination, status, created_at")
        .eq("status", "pending")
        .eq("email", user.email.toLowerCase())
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const invitationError = params.invitationError
    ? "O convite não está mais disponível ou não pôde ser atualizado."
    : null;

  const searchTerm = (params.q ?? "").trim().toLowerCase();
  const statusFilter: StatusFilter = statusFilters.includes(params.status as StatusFilter)
    ? (params.status as StatusFilter)
    : "all";
  const sortOption: SortOption = sortOptions.includes(params.sort as SortOption)
    ? (params.sort as SortOption)
    : "date";
  const today = new Date().toISOString().slice(0, 10);
  const allTrips = (trips ?? []) as Trip[];
  const filteredTrips = allTrips
    .filter((trip) => trip.destination.toLowerCase().includes(searchTerm))
    .filter((trip) => {
      const status = tripStatus(trip, today);
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
              Travel Organizer
            </p>
            <CardTitle className="mt-2 text-3xl">Bem-vindo, {displayName}</CardTitle>
            <CardDescription className="mt-2 text-base">
              Crie uma viagem e mantenha os detalhes do planejamento em um espaço privado.
            </CardDescription>
            <CardAction className="flex items-center gap-3">
              <NotificationBell notifications={(notifications ?? []) as Notification[]} />
              <form action={signOut}>
                <SubmitButton pendingLabel="Saindo..." variant="outline">Sair</SubmitButton>
              </form>
            </CardAction>
          </CardHeader>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">Editar perfil</CardTitle>
            <CardDescription>
              Esse é o nome exibido para outros participantes nas suas viagens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getAuthMessage(params.profileError) ? (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {getAuthMessage(params.profileError)}
              </p>
            ) : null}
            {getAuthMessage(params.profileMessage) ? (
              <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                {getAuthMessage(params.profileMessage)}
              </p>
            ) : null}
            <form action={updateDisplayName} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="displayName">Nome de exibição</Label>
                <Input
                  required
                  minLength={2}
                  maxLength={100}
                  id="displayName"
                  name="displayName"
                  defaultValue={displayName}
                />
              </div>
              <SubmitButton pendingLabel="Salvando..." variant="outline">Salvar nome</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">Lembretes por e-mail</CardTitle>
            <CardDescription>
              Receba um lembrete quando uma tarefa atribuída vencer nos próximos três dias.
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
                Enviar lembretes de prazos de tarefas
              </label>
              <SubmitButton pendingLabel="Salvando..." variant="outline">Salvar preferência</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">Alterar senha</CardTitle>
            <CardDescription>
              Escolha uma nova senha para sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getAuthMessage(params.passwordError) ? (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {getAuthMessage(params.passwordError)}
              </p>
            ) : null}
            {getAuthMessage(params.passwordMessage) ? (
              <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                {getAuthMessage(params.passwordMessage)}
              </p>
            ) : null}
            <form action={changePassword} className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input required autoComplete="new-password" id="password" name="password" type="password" minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirmation">Confirmar nova senha</Label>
                <Input required autoComplete="new-password" id="passwordConfirmation" name="passwordConfirmation" type="password" minLength={8} />
              </div>
              <SubmitButton pendingLabel="Salvando..." variant="outline" className="sm:col-span-2 sm:justify-self-start">
                Atualizar senha
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {pendingInvitations?.length || invitationError || invitationsError ? (
          <Card className="border-sky-200 bg-sky-50 [--card-spacing:--spacing(8)]">
            <CardHeader>
              <CardTitle className="text-2xl">Convites de viagem</CardTitle>
            </CardHeader>
            <CardContent>
              {invitationError || invitationsError ? (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {invitationError ?? "Não foi possível carregar seus convites."}
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
                        Você foi convidado para colaborar como organizador da viagem.
                      </p>
                      <form action={respondToInvitation} className="mt-4 flex gap-3">
                        <input
                          type="hidden"
                          name="invitationId"
                          value={invitation.id}
                        />
                        <SubmitButton pendingLabel="Respondendo..." name="response" value="accepted">
                          Aceitar
                        </SubmitButton>
                        <SubmitButton pendingLabel="Respondendo..." name="response" value="declined" variant="outline">
                          Recusar
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
            <CardTitle className="text-2xl">Criar uma viagem</CardTitle>
            <CardDescription>
              Comece com o destino e as datas. Mais ferramentas de planejamento serão adicionadas dentro da viagem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TripForm />
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-2xl">Suas viagens</CardTitle>
          </CardHeader>
          <CardContent>
            {allTrips.length ? (
              <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="q" className="text-slate-700">Destino</Label>
                  <Input
                    id="q"
                    name="q"
                    defaultValue={params.q}
                    placeholder="Buscar por destino..."
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status-filter" className="text-slate-700">Status</Label>
                  <Select name="status" defaultValue={statusFilter}>
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
                  <Label htmlFor="sort-option" className="text-slate-700">Ordenar por</Label>
                  <Select name="sort" defaultValue={sortOption}>
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
                <Button type="submit">Buscar</Button>
                {hasActiveFilters ? (
                  <Link
                    href="/dashboard"
                    className="text-sm font-semibold text-primary hover:text-primary/80"
                  >
                    Limpar filtros
                  </Link>
                ) : null}
              </form>
            ) : null}

            {tripsError ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                Não foi possível carregar suas viagens. Tente atualizar a página.
              </p>
            ) : filteredTrips.length ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {filteredTrips.map((trip) => {
                  const status = tripStatus(trip, today);
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
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : allTrips.length ? (
              <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                Nenhuma viagem encontrada com esses filtros.{" "}
                <Link href="/dashboard" className="font-semibold text-primary hover:text-primary/80">
                  Limpar filtros
                </Link>
              </p>
            ) : (
              <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                Nenhuma viagem ainda. Crie sua primeira viagem acima.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
