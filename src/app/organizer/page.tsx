import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ApplyTemplateForm } from "@/features/prep-catalog/apply-template-form";
import { deleteTemplate } from "@/features/prep-catalog/actions";
import { TemplateForm } from "@/features/prep-catalog/template-form";
import {
  getClassificationLabels,
  getContinentLabels,
  getPrepItemTypeLabels,
  type Classification,
  type Continent,
  type PrepItemType,
} from "@/features/prep-catalog/shared";
import { getTaskCategoryLabels, type TaskCategory } from "@/features/tasks/templates";
import { deleteTask, setTaskCompletion } from "@/features/tasks/actions";
import { PrepItemForm } from "@/features/tasks/prep-item-form";
import { TripForm } from "@/features/trips/trip-form";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ItemActionsMenu } from "@/components/item-actions-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OrganizerPageProps = {
  searchParams: Promise<{ trip?: string }>;
};

type OrganizedTrip = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string | null;
};

type DashboardTripStats = {
  trip_id: string;
  readiness_percentage: number;
  critical_open_count: number;
  participant_count: number;
};

type Template = {
  id: string;
  title: string;
  item_type: PrepItemType;
  category: TaskCategory;
  continent: Continent | null;
  country: string;
  city: string | null;
  classification: Classification;
  due_offset_days: number | null;
  currency: string | null;
  estimated_amount: string | null;
  document_instructions: string | null;
};

type GovernedTask = {
  id: string;
  title: string;
  owner_id: string | null;
  due_date: string | null;
  due_offset_days: number | null;
  completed_at: string | null;
  category: TaskCategory;
  is_critical: boolean;
  item_type: PrepItemType;
  continent: Continent;
  country: string;
  city: string | null;
  classification: Classification;
  currency: string | null;
  estimated_amount: string | null;
  paid_amount: string | null;
  itinerary_item_id: string | null;
  document_instructions: string | null;
  expense_id: string | null;
};

export default async function OrganizerPage({ searchParams }: OrganizerPageProps) {
  const { trip: selectedTripId } = await searchParams;
  const t = await getTranslations("organizerPanel");
  const taskCategoryLabels = getTaskCategoryLabels(await getTranslations("categories.task"));
  const prepItemTypeLabels = getPrepItemTypeLabels(await getTranslations("categories.prepItemType"));
  const classificationLabels = getClassificationLabels(await getTranslations("categories.classification"));
  const continentLabels = getContinentLabels(await getTranslations("categories.continent"));
  const format = await getFormatter();
  const formatDate = (value: string) => format.dateTime(new Date(`${value}T00:00:00Z`), "medium");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_traveler, is_organizer")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_organizer) {
    redirect("/dashboard?error=organizer_access_required");
  }

  const { data: organizerRows } = await supabase
    .from("trip_participants")
    .select("trip_id")
    .eq("user_id", user.id)
    .eq("role", "organizer");
  const organizerTripIds = (organizerRows ?? []).map((row) => row.trip_id);

  const tripsQuery = organizerTripIds.length
    ? supabase
        .from("trips")
        .select("id, destination, start_date, end_date")
        .or(`created_by.eq.${user.id},id.in.(${organizerTripIds.join(",")})`)
    : supabase
        .from("trips")
        .select("id, destination, start_date, end_date")
        .eq("created_by", user.id);

  const [{ data: organizedTrips, error: tripsError }, { data: tripStats }, { data: templates, error: templatesError }] =
    await Promise.all([
      tripsQuery.order("start_date", { ascending: true }),
      supabase.rpc("get_dashboard_trip_stats"),
      supabase
        .from("prep_item_templates")
        .select(
          "id, title, item_type, category, continent, country, city, classification, due_offset_days, currency, estimated_amount, document_instructions",
        )
        .order("created_at", { ascending: false }),
    ]);

  const trips = (organizedTrips ?? []) as OrganizedTrip[];
  const tripStatsByTripId = new Map(
    ((tripStats ?? []) as DashboardTripStats[]).map((stats) => [stats.trip_id, stats]),
  );
  const templateList = (templates ?? []) as Template[];

  const selectedTrip = selectedTripId
    ? trips.find((trip) => trip.id === selectedTripId)
    : undefined;

  let governedTasks: GovernedTask[] = [];
  let tasksError: unknown = null;
  let tripParticipants: { user_id: string; display_name: string; role: string }[] = [];
  let itineraryItemOptions: { id: string; title: string }[] = [];

  if (selectedTrip) {
    const [tasksResult, participantsResult, itineraryResult] = await Promise.all([
      supabase
        .from("trip_tasks")
        .select(
          "id, title, owner_id, due_date, due_offset_days, completed_at, category, is_critical, item_type, continent, country, city, classification, currency, estimated_amount, paid_amount, itinerary_item_id, document_instructions, expense_id",
        )
        .eq("trip_id", selectedTrip.id)
        .not("classification", "is", null)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.rpc("get_trip_participants", { requested_trip_id: selectedTrip.id }),
      supabase
        .from("itinerary_items")
        .select("id, title")
        .eq("trip_id", selectedTrip.id),
    ]);
    governedTasks = (tasksResult.data ?? []) as GovernedTask[];
    tasksError = tasksResult.error;
    tripParticipants = participantsResult.data ?? [];
    itineraryItemOptions = itineraryResult.data ?? [];
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{t("eyebrow")}</p>
            <CardTitle className="mt-2 text-3xl">{t("title")}</CardTitle>
            <CardDescription className="mt-2 text-base">{t("description")}</CardDescription>
            <CardAction className="flex items-center gap-3">
              <LanguageSwitcher />
              <ThemeToggle />
              {profile.is_traveler ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t("modeSwitcher.currentModeOrganizer")}</Badge>
                  <Link href="/dashboard" className="text-sm font-semibold text-primary hover:text-primary/80">
                    {t("modeSwitcher.switchToTraveler")}
                  </Link>
                </div>
              ) : null}
            </CardAction>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard" className="text-sm font-semibold text-primary hover:text-primary/80">
              {t("backToDashboard")}
            </Link>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-2xl">{t("createTrip.title")}</CardTitle>
            <CardDescription>{t("createTrip.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TripForm />
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-2xl">{t("catalog.title")}</CardTitle>
            <CardDescription>{t("catalog.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="rounded-2xl bg-slate-50 p-5" open={!templateList.length}>
              <summary className="cursor-pointer font-semibold text-slate-900">{t("catalog.addTemplate")}</summary>
              <div className="mt-5">
                <TemplateForm />
              </div>
            </details>

            {templatesError ? (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("catalog.loadError")}
              </p>
            ) : templateList.length ? (
              <ul className="mt-6 space-y-4">
                {templateList.map((template) => (
                  <li key={template.id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{template.title}</h3>
                          <Badge variant="outline">{prepItemTypeLabels[template.item_type]}</Badge>
                          <Badge variant="outline">{classificationLabels[template.classification]}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {[
                            taskCategoryLabels[template.category],
                            template.continent ? continentLabels[template.continent] : null,
                            template.country,
                            template.city,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {template.due_offset_days ? (
                          <p className="mt-1 text-sm text-slate-600">
                            {t("catalog.daysBeforeDeparture", { count: template.due_offset_days })}
                          </p>
                        ) : null}
                      </div>
                      <ItemActionsMenu
                        editLabel={t("catalog.editTemplate")}
                        editForm={<TemplateForm template={template} />}
                        deleteAction={deleteTemplate}
                        deleteHiddenFields={{ templateId: template.id }}
                        deleteTitle={t("catalog.deleteTemplateTitle")}
                        deleteDescription={t("catalog.deleteTemplateDescription", { title: template.title })}
                        deleteLabel={t("catalog.removeTemplate")}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                {t("catalog.empty")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-2xl">{t("trips.title")}</CardTitle>
            <CardDescription>{t("trips.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {tripsError ? (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{t("trips.loadError")}</p>
            ) : trips.length ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {trips.map((trip) => {
                  const stats = tripStatsByTripId.get(trip.id);
                  const isSelected = selectedTrip?.id === trip.id;
                  return (
                    <li key={trip.id}>
                      <Link
                        href={`/organizer?trip=${trip.id}`}
                        className={`block h-full rounded-2xl border p-5 transition hover:border-sky-300 hover:bg-sky-50 ${
                          isSelected ? "border-sky-400 bg-sky-50" : "border-slate-200"
                        }`}
                      >
                        <h3 className="text-lg font-semibold text-slate-950">{trip.destination}</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          {formatDate(trip.start_date)}
                          {trip.end_date ? ` – ${formatDate(trip.end_date)}` : ""}
                        </p>
                        {stats ? (
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span>{t("trips.readiness", { percent: stats.readiness_percentage })}</span>
                            <span aria-hidden="true">·</span>
                            <span className={stats.critical_open_count ? "font-semibold text-amber-800" : undefined}>
                              {t("trips.criticalOpen", { count: stats.critical_open_count })}
                            </span>
                          </div>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                {t("trips.empty")}
              </p>
            )}
          </CardContent>
        </Card>

        {selectedTrip ? (
          <Card className="[--card-spacing:--spacing(8)]">
            <CardHeader>
              <CardTitle className="text-2xl">{t("tripDetail.title", { destination: selectedTrip.destination })}</CardTitle>
              <CardDescription>{t("tripDetail.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <h3 className="text-lg font-semibold text-slate-950">{t("tripDetail.applyTitle")}</h3>
              <div className="mt-4">
                <ApplyTemplateForm
                  itineraryItems={itineraryItemOptions}
                  participants={tripParticipants}
                  templates={templateList}
                  tripId={selectedTrip.id}
                />
              </div>

              <div className="mt-8 border-t border-slate-200 pt-8">
                <h3 className="text-lg font-semibold text-slate-950">{t("tripDetail.itemsTitle")}</h3>
                {tasksError ? (
                  <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                    {t("tripDetail.loadError")}
                  </p>
                ) : governedTasks.length ? (
                  <ul className="mt-4 space-y-4">
                    {governedTasks.map((task) => (
                      <li key={task.id} className="rounded-2xl border border-slate-200 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className={`font-semibold ${task.completed_at ? "text-slate-500 line-through" : "text-slate-950"}`}>
                                {task.title}
                              </h4>
                              <Badge variant="outline">{prepItemTypeLabels[task.item_type]}</Badge>
                              <Badge variant="outline">{classificationLabels[task.classification]}</Badge>
                              {task.completed_at ? (
                                <Badge className="bg-emerald-100 text-emerald-800">{t("tripDetail.badgeCompleted")}</Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {continentLabels[task.continent]} · {task.country}
                              {task.city ? ` · ${task.city}` : ""}
                            </p>
                            {task.due_date ? (
                              <p className="mt-1 text-sm text-slate-600">{t("tripDetail.dueDate", { date: formatDate(task.due_date) })}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <form action={setTaskCompletion}>
                              <input type="hidden" name="tripId" value={selectedTrip.id} />
                              <input type="hidden" name="taskId" value={task.id} />
                              <input type="hidden" name="completed" value={task.completed_at ? "false" : "true"} />
                              <SubmitButton
                                pendingLabel={task.completed_at ? t("tripDetail.reopeningPending") : t("tripDetail.completingPending")}
                                variant="outline"
                                size="sm"
                              >
                                {task.completed_at ? t("tripDetail.reopen") : t("tripDetail.complete")}
                              </SubmitButton>
                            </form>
                            <ItemActionsMenu
                              editLabel={t("tripDetail.editItem")}
                              editForm={
                                <PrepItemForm
                                  itineraryItems={itineraryItemOptions}
                                  participants={tripParticipants}
                                  task={task}
                                  tripId={selectedTrip.id}
                                />
                              }
                              deleteAction={deleteTask}
                              deleteHiddenFields={{ tripId: selectedTrip.id, taskId: task.id }}
                              deleteTitle={t("tripDetail.deleteItemTitle")}
                              deleteDescription={t("tripDetail.deleteItemDescription", { title: task.title })}
                              deleteLabel={t("tripDetail.removeItem")}
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                    {t("tripDetail.empty")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
