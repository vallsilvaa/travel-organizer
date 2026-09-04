import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { deleteTemplate } from "@/features/prep-catalog/actions";
import { NewTaskModal } from "@/features/prep-catalog/new-task-modal";
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
import { NewTripModal } from "@/features/trips/new-trip-modal";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ItemActionsMenu } from "@/components/item-actions-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export default async function OrganizerPage() {
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
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <NewTripModal templates={templateList} />
              <NewTaskModal />
            </div>
            <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-primary hover:text-primary/80">
              {t("backToDashboard")}
            </Link>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-2xl">{t("catalog.title")}</CardTitle>
            <CardDescription>{t("catalog.description")}</CardDescription>
            <CardAction>
              <NewTaskModal triggerLabel={t("catalog.addTemplate")} triggerVariant="outline" triggerSize="default" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {templatesError ? (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("catalog.loadError")}
              </p>
            ) : templateList.length ? (
              <ul className="space-y-4">
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
              <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
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
                  return (
                    <li key={trip.id}>
                      <Link
                        href={`/trips/${trip.id}`}
                        className="block h-full rounded-2xl border border-slate-200 p-5 transition hover:border-sky-300 hover:bg-sky-50"
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
                            <span aria-hidden="true">·</span>
                            <span>{t("trips.participants", { count: stats.participant_count })}</span>
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
      </div>
    </main>
  );
}
