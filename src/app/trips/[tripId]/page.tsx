import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttachmentForm } from "@/features/attachments/attachment-form";
import { deleteAttachment } from "@/features/attachments/actions";
import { formatFileSize } from "@/features/attachments/validation";
import { CommentThread, type ItemComment } from "@/features/comments/comment-thread";
import { DestinationGuideForm } from "@/features/destination-guide/destination-guide-form";
import { deleteExpense } from "@/features/expenses/actions";
import { computeSettlements } from "@/features/expenses/balances";
import { ExpenseCategoryChart, type ExpenseCategoryChartDatum } from "@/features/expenses/category-chart";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { RemindBalanceButton } from "@/features/expenses/remind-balance-button";
import { getExpenseCategoryLabels } from "@/features/expenses/validation";
import {
  cancelInvitation,
  resendInvitation,
} from "@/features/invitations/actions";
import { InviteForm } from "@/features/invitations/invite-form";
import { getInvitationRoleLabels } from "@/features/invitations/validation";
import { buildTripActions } from "@/features/itinerary/tab/grouping";
import { ItineraryTab } from "@/features/itinerary/tab/itinerary-tab";
import { getItineraryPeriodLabels, itineraryPeriods } from "@/features/itinerary/validation";
import { removeParticipant } from "@/features/participants/actions";
import { RealtimeStatus } from "@/features/realtime/realtime-status";
import { ConfirmationCode } from "@/features/reservations/confirmation-code";
import { deleteReservation } from "@/features/reservations/actions";
import { ReservationForm } from "@/features/reservations/reservation-form";
import { getReservationTypeLabels, type ReservationType } from "@/features/reservations/validation";
import {
  deleteTask,
  setTaskCompletion,
} from "@/features/tasks/actions";
import { TaskForm } from "@/features/tasks/task-form";
import { PrepItemForm } from "@/features/tasks/prep-item-form";
import { TaskCompletionDialog } from "@/features/tasks/task-completion-dialog";
import {
  taskCategories,
  getTaskCategoryLabels,
  type TaskCategory,
} from "@/features/tasks/templates";
import { AddTaskFromCatalogModal } from "@/features/prep-catalog/add-task-from-catalog-modal";
import { NewTaskModal } from "@/features/prep-catalog/new-task-modal";
import {
  getClassificationLabels,
  getContinentLabels,
  getPrepItemActionLabels,
  getPrepItemTypeLabels,
  resolveActionLabel,
  timelineOffsets,
  type Classification,
  type Continent,
  type PrepItemType,
} from "@/features/prep-catalog/shared";
import { localeTag } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { CollapsibleFormPanel } from "@/components/collapsible-form-panel";
import { ItemActionsMenu } from "@/components/item-actions-menu";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { archiveTrip, deleteTrip, restoreTrip } from "@/features/trips/actions";
import { CoverImageForm } from "@/features/trips/cover-image-form";
import { ShareLinkPanel } from "@/features/trip-sharing/share-link-panel";
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
import { daysUntil, todayInTimeZone } from "@/lib/timezone";
import { tripStatus } from "@/lib/trip-status";

type TripPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ category?: string; city?: string; critical?: string; dueOffset?: string; expenseView?: string; overdue?: string; owner?: string; period?: string; status?: string; tripError?: string; tab?: string }>;
};

type TripParticipant = {
  user_id: string;
  display_name: string;
  role: string;
};

type TripDestination = {
  id: string;
  label: string;
  city: string | null;
  country: string;
  continent: Continent | null;
  granularity: "city" | "country";
  position: number;
};

type CatalogTemplate = {
  id: string;
  title: string;
  action: string | null;
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

type TripComment = ItemComment & {
  item_type: "itinerary" | "task";
  itinerary_item_id: string | null;
  task_id: string | null;
};

type TripExpense = {
  id: string;
  description: string;
  amount: string | null;
  currency: string;
  category: string;
  expense_date: string;
  payer_id: string | null;
  payment_status: "paid" | "to_pay";
  estimated_amount: string | null;
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

type ExpenseSummaryRow = {
  currency: string;
  estimated_total: string;
  paid_total: string;
  to_pay_total: string;
};

type TripAttachment = {
  id: string;
  item_type: "itinerary" | "task" | "reservation" | "expense" | null;
  item_id: string | null;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  downloadUrl?: string | null;
};

function attachmentItemLabel(
  attachment: TripAttachment,
  itineraryTitles: Map<string, string>,
  taskTitles: Map<string, string>,
  reservationTitles: Map<string, string>,
  expenseTitles: Map<string, string>,
  itemTypeLabels: Record<string, string>,
  removedItemLabel: string,
) {
  if (!attachment.item_type || !attachment.item_id) {
    return "";
  }
  const titlesByType: Record<string, Map<string, string>> = {
    itinerary: itineraryTitles,
    task: taskTitles,
    reservation: reservationTitles,
    expense: expenseTitles,
  };
  const title = titlesByType[attachment.item_type]?.get(attachment.item_id) ?? removedItemLabel;
  return `${itemTypeLabels[attachment.item_type]}: ${title}`;
}

type TripReservation = {
  id: string;
  reservation_type: ReservationType;
  title: string;
  provider: string | null;
  confirmation_code: string | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: string | null;
  destination_location: string | null;
  notes: string | null;
  itinerary_item_id: string | null;
  paid_amount: string | null;
  currency: string | null;
  payment_status: "paid" | "to_pay" | null;
  expense_id: string | null;
};

type TripTask = {
  id: string;
  title: string;
  action: string | null;
  owner_id: string | null;
  due_date: string | null;
  due_offset_days: number | null;
  completed_at: string | null;
  created_at: string;
  category: TaskCategory;
  is_critical: boolean;
  template_key: string | null;
  template_id: string | null;
  reference_label: string | null;
  reference_url: string | null;
  item_type: PrepItemType;
  continent: Continent | null;
  country: string | null;
  city: string | null;
  classification: Classification | null;
  currency: string | null;
  estimated_amount: string | null;
  paid_amount: string | null;
  itinerary_item_id: string | null;
  document_instructions: string | null;
  expense_id: string | null;
};

const reservationBadgeVariant: Record<ReservationType, "default" | "secondary" | "outline"> = {
  flight: "default",
  lodging: "secondary",
  transport: "outline",
  tickets: "secondary",
};

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
    .select("id, title, destination, start_date, end_date, created_at, created_by, archived_at, timezone, cover_image_path, destination_guide_content, destination_guide_source, destination_guide_reviewed_at")
    .eq("id", tripId)
    .single();

  if (error || !trip) {
    notFound();
  }

  const t = await getTranslations("trip");
  const tCoverImage = await getTranslations("coverImage");
  const tCommon = await getTranslations("common");
  const tTemplateForm = await getTranslations("templateForm");
  const timelineOffsetLabels: Record<number, string> = Object.fromEntries(
    timelineOffsets.map((offset) => [
      offset,
      offset === 1 ? tTemplateForm("timelineOffsetEve") : tTemplateForm("timelineOffsetDays", { count: offset }),
    ]),
  );
  const taskCategoryLabels = getTaskCategoryLabels(await getTranslations("categories.task"));
  const expenseCategoryLabels = getExpenseCategoryLabels(await getTranslations("categories.expense"));
  const reservationTypeLabels = getReservationTypeLabels(await getTranslations("categories.reservationType"));
  const itineraryPeriodLabels = getItineraryPeriodLabels(await getTranslations("categories.itineraryPeriod"));
  const invitationRoleLabels = getInvitationRoleLabels(await getTranslations("categories.invitationRole"));
  const prepItemTypeLabels = getPrepItemTypeLabels(await getTranslations("categories.prepItemType"));
  const prepItemActionLabels = getPrepItemActionLabels(await getTranslations("categories.prepItemAction"));
  const classificationLabels = getClassificationLabels(await getTranslations("categories.classification"));
  const continentLabels = getContinentLabels(await getTranslations("categories.continent"));
  const locale = await getLocale();
  const format = await getFormatter();
  const formatDate = (value: string) => format.dateTime(new Date(`${value}T00:00:00Z`), "long");
  const formatWeekday = (value: string) => format.dateTime(new Date(`${value}T00:00:00Z`), "weekday");
  const formatTime = (value: string | null) => (value ? value.slice(0, 5) : t("itinerary.noTimeSet"));
  const formatItineraryWhen = (item: { start_time: string | null; period: string | null }) => {
    if (item.start_time) {
      return formatTime(item.start_time);
    }
    if (item.period && itineraryPeriodLabels[item.period as (typeof itineraryPeriods)[number]]) {
      return itineraryPeriodLabels[item.period as (typeof itineraryPeriods)[number]];
    }
    return t("itinerary.noTimeSet");
  };
  const formatReservationWhen = (reservation: {
    start_date: string;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
  }) => {
    const start = `${formatDate(reservation.start_date)} · ${formatTime(reservation.start_time)}`;
    if (!reservation.end_date) {
      return start;
    }
    const sameDay = reservation.end_date === reservation.start_date;
    const end = sameDay
      ? formatTime(reservation.end_time)
      : `${formatDate(reservation.end_date)} · ${formatTime(reservation.end_time)}`;
    return `${start} → ${end}`;
  };
  const formatMoney = (amount: number | string, currency: string) => {
    try {
      return format.number(Number(amount), { style: "currency", currency });
    } catch {
      return `${currency} ${Number(amount).toFixed(2)}`;
    }
  };
  const invitationStatusLabels: Record<string, string> = {
    pending: t("organizer.invitationStatus.pending"),
    accepted: t("organizer.invitationStatus.accepted"),
    declined: t("organizer.invitationStatus.declined"),
    cancelled: t("organizer.invitationStatus.cancelled"),
  };
  const attachmentItemTypeLabels: Record<string, string> = {
    itinerary: t("documents.itemLabels.itinerary"),
    task: t("documents.itemLabels.task"),
    reservation: t("documents.itemLabels.reservation"),
    expense: t("documents.itemLabels.expense"),
  };

  const isCreator = trip.created_by === user.id;
  const isArchived = Boolean(trip.archived_at);
  const currentTripStatus = tripStatus(trip);
  // New participants can only be invited while the trip is still "Futura"
  // (#213) - the same rule is enforced server-side in inviteParticipant.
  const canInviteParticipants = currentTripStatus === "upcoming";
  // "Em aberto" is the default (#171) - "all" only applies when the URL
  // explicitly asks for it, so landing on the tab with no query params
  // never shows completed tasks mixed in.
  const statusFilter = filters.status === "completed" || filters.status === "all"
    ? filters.status
    : "open";
  const ownerFilter = filters.owner ?? "all";
  const categoryFilter = taskCategories.includes(filters.category as TaskCategory)
    ? filters.category as TaskCategory
    : "all";
  const dueOffsetFilter = timelineOffsets.includes(Number(filters.dueOffset) as (typeof timelineOffsets)[number])
    ? Number(filters.dueOffset)
    : "all";
  const criticalOnlyFilter = filters.critical === "1";
  const overdueOnlyFilter = filters.overdue === "1";
  const expenseView = filters.expenseView === "category" || filters.expenseView === "payer"
    ? filters.expenseView
    : "all";
  const cityFilter = filters.city ?? "all";
  const itineraryPeriodFilter = itineraryPeriods.includes(filters.period as (typeof itineraryPeriods)[number])
    ? (filters.period as (typeof itineraryPeriods)[number])
    : "all";

  const [
    { data: destinations },
    { data: itineraryItems, error: itineraryError },
    { data: reservations, error: reservationsError },
    { data: attachments, error: attachmentsError },
    { data: tasks, error: tasksError },
    { data: participants },
    { data: comments, error: commentsError },
    { data: expenses, error: expensesError },
    { data: expenseShares },
    { data: expenseBalances },
    { data: expenseSummary },
    invitationResult,
    templatesResult,
    { data: shareLinks },
  ] =
    await Promise.all([
      supabase
        .from("trip_destinations")
        .select("id, label, city, country, continent, granularity, position")
        .eq("trip_id", trip.id)
        .order("position", { ascending: true }),
      supabase
        .from("itinerary_items")
        .select("id, item_date, start_time, title, location, notes, period, city, action, template_id")
        .eq("trip_id", trip.id)
        .order("item_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false }),
      supabase
        .from("trip_reservations")
        .select("id, reservation_type, title, provider, confirmation_code, start_date, start_time, end_date, end_time, location, destination_location, notes, itinerary_item_id, paid_amount, currency, payment_status, expense_id")
        .eq("trip_id", trip.id)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false }),
      supabase
        .from("trip_attachments")
        .select("id, item_type, item_id, storage_path, file_name, content_type, size_bytes")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("trip_tasks")
        .select("id, title, action, owner_id, due_date, due_offset_days, completed_at, created_at, category, is_critical, template_key, template_id, reference_label, reference_url, item_type, continent, country, city, classification, currency, estimated_amount, paid_amount, itinerary_item_id, document_instructions, expense_id")
        .eq("trip_id", trip.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase.rpc("get_trip_participants", { requested_trip_id: trip.id }),
      supabase
        .from("item_comments")
        .select("id, item_type, itinerary_item_id, task_id, body, author_id, created_at, updated_at")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("trip_expenses")
        .select("id, description, amount, currency, category, expense_date, payer_id, payment_status, estimated_amount")
        .eq("trip_id", trip.id)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("trip_expense_shares")
        .select("expense_id, user_id, share_amount")
        .eq("trip_id", trip.id),
      supabase.rpc("get_trip_expense_balances", { requested_trip_id: trip.id }),
      supabase.rpc("get_trip_expense_summary", { requested_trip_id: trip.id }),
      isCreator
        ? supabase
            .from("trip_invitations")
            .select("id, email, status, role, created_at, expires_at")
            .eq("trip_id", trip.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      // Not gated by isCreator: RLS already scopes this to the caller's own
      // catalog (owner_id = auth.uid()), and every participant can add prep
      // tasks (not just the organizer) - a creator-only gate here would leave
      // them with an "Add from catalog" button that always shows an empty list.
      supabase
        .from("prep_item_templates")
        .select(
          "id, title, action, item_type, category, continent, country, city, classification, due_offset_days, currency, estimated_amount, document_instructions",
        )
        .order("created_at", { ascending: false }),
      isCreator
        ? supabase
            .from("trip_share_links")
            .select("id, token")
            .eq("trip_id", trip.id)
            .is("revoked_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] }),
    ]);
  const tripDestinations = (destinations ?? []) as TripDestination[];
  const invitations = invitationResult.data;
  const catalogTemplates = (templatesResult.data ?? []) as CatalogTemplate[];
  const existingTemplateActions = Array.from(
    new Set(
      catalogTemplates
        .map((template) => template.action)
        .filter((action): action is string => Boolean(action)),
    ),
  );
  const tripParticipants = (participants ?? []) as TripParticipant[];
  const participantNames = new Map<string, string>(
    tripParticipants.map((participant) => [
      participant.user_id,
      participant.display_name,
    ]),
  );
  // A participant invited with role="organizer" has the same standing as
  // the trip creator for managing trip content (#173) - the creator is
  // just the one guaranteed organizer, not the only one.
  const isTripOrganizer =
    isCreator || tripParticipants.some((participant) => participant.user_id === user.id && participant.role === "organizer");
  const canEditDestinationGuide = isTripOrganizer;
  const activeShareLinkRow = ((shareLinks ?? []) as { id: string; token: string }[])[0] ?? null;
  const shareBaseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const activeShareLink = activeShareLinkRow
    ? { id: activeShareLinkRow.id, url: `${shareBaseUrl}/share/${activeShareLinkRow.token}` }
    : null;
  let coverImageUrl: string | null = null;
  if (trip.cover_image_path) {
    const { data: signedCover } = await supabase.storage
      .from("trip-attachments")
      .createSignedUrl(trip.cover_image_path, 3600);
    coverImageUrl = signedCover?.signedUrl ?? null;
  }
  const today = todayInTimeZone(trip.timezone);
  const tripEndDate = trip.end_date ?? trip.start_date;
  const countdownLabel =
    today < trip.start_date
      ? t("countdown.days", { days: daysUntil(trip.start_date, today) })
      : today <= tripEndDate
        ? t("countdown.inProgress")
        : null;
  const allTasks = (tasks ?? []) as TripTask[];
  const appliedTemplateIds = allTasks
    .map((task) => task.template_id)
    .filter((templateId): templateId is string => Boolean(templateId));
  const appliedItineraryTemplateIds = (itineraryItems ?? [])
    .map((item) => item.template_id)
    .filter((templateId): templateId is string => Boolean(templateId));
  // Check-in/Check-out are always offered as suggestions even before the
  // trip has any itinerary action set, plus anything already typed on this
  // trip's items (#222). Shared with the preparation tab's own itinerary
  // action suggestions below, not just the itinerary tab.
  const tripActions = buildTripActions(itineraryItems ?? [], [
    t("itinerary.actionPresetCheckIn"),
    t("itinerary.actionPresetCheckOut"),
  ]);
  const filteredTasks = allTasks.filter((task) => {
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "completed" ? Boolean(task.completed_at) : !task.completed_at);
    const matchesOwner = ownerFilter === "all"
      || (ownerFilter === "unassigned" ? !task.owner_id : task.owner_id === ownerFilter);
    const matchesCategory = categoryFilter === "all" || task.category === categoryFilter;
    const matchesDueOffset = dueOffsetFilter === "all" || task.due_offset_days === dueOffsetFilter;
    const matchesCritical = !criticalOnlyFilter || task.is_critical;
    const matchesOverdue = !overdueOnlyFilter
      || Boolean(!task.completed_at && task.due_date && task.due_date < today);
    return matchesStatus && matchesOwner && matchesCategory && matchesDueOffset && matchesCritical && matchesOverdue;
  });
  const completedTaskCount = allTasks.filter((task) => task.completed_at).length;
  const readiness = allTasks.length
    ? Math.round((completedTaskCount / allTasks.length) * 100)
    : 0;
  const criticalOpenCount = allTasks.filter((task) => task.is_critical && !task.completed_at).length;
  const overdueTaskCount = allTasks.filter((task) => !task.completed_at && task.due_date && task.due_date < today).length;
  const readinessByCategory = taskCategories
    .map((category) => {
      const categoryTasks = allTasks.filter((task) => task.category === category);
      const completed = categoryTasks.filter((task) => task.completed_at).length;
      return {
        category,
        label: taskCategoryLabels[category],
        total: categoryTasks.length,
        completed,
        percent: categoryTasks.length ? Math.round((completed / categoryTasks.length) * 100) : 0,
      };
    })
    .filter((row) => row.total > 0);
  // The DB query already sorts open tasks by due_date asc (nulls last),
  // then created_at, then id - most overdue first, then soonest-due, then
  // furthest out, with no-deadline tasks trailing (#171). Viewing
  // completed tasks instead uses the opposite, most-recently-finished
  // priority, so it's resorted here rather than at the query level.
  const sortedTasks = statusFilter === "completed"
    ? [...filteredTasks].sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    : filteredTasks;
  const tripComments = (comments ?? []) as TripComment[];
  const tripReservations = (reservations ?? []) as TripReservation[];
  const rawAttachments = (attachments ?? []) as TripAttachment[];
  const signedUrlsByPath = new Map<string, string>();
  if (rawAttachments.length) {
    const { data: signedUrls } = await supabase.storage
      .from("trip-attachments")
      .createSignedUrls(rawAttachments.map((attachment) => attachment.storage_path), 300);
    for (const signed of signedUrls ?? []) {
      if (signed.signedUrl && signed.path) {
        signedUrlsByPath.set(signed.path, signed.signedUrl);
      }
    }
  }
  const tripAttachments: TripAttachment[] = rawAttachments.map((attachment) => ({
    ...attachment,
    downloadUrl: signedUrlsByPath.get(attachment.storage_path) ?? null,
  }));
  const itineraryTitles = new Map((itineraryItems ?? []).map((item) => [item.id, item.title]));
  const taskTitles = new Map((tasks ?? []).map((task) => [task.id, task.title]));
  const tasksByItineraryItemId = new Map<string, { id: string; title: string; completed_at: string | null }[]>();
  for (const task of (tasks ?? []) as TripTask[]) {
    if (!task.itinerary_item_id) {
      continue;
    }
    const list = tasksByItineraryItemId.get(task.itinerary_item_id) ?? [];
    list.push({ id: task.id, title: task.title, completed_at: task.completed_at });
    tasksByItineraryItemId.set(task.itinerary_item_id, list);
  }
  const reservationTitles = new Map(tripReservations.map((reservation) => [reservation.id, reservation.title]));
  const itineraryItemOptions = (itineraryItems ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    item_date: item.item_date,
  }));
  const reservationsByItineraryItemId = new Map<string, TripReservation[]>();
  for (const reservation of tripReservations) {
    if (!reservation.itinerary_item_id) {
      continue;
    }
    const list = reservationsByItineraryItemId.get(reservation.itinerary_item_id) ?? [];
    list.push(reservation);
    reservationsByItineraryItemId.set(reservation.itinerary_item_id, list);
  }
  const tripExpenses = (expenses ?? []) as TripExpense[];
  const expenseTitles = new Map(tripExpenses.map((expense) => [expense.id, expense.description]));
  const attachmentsByExpenseId = new Map<string, TripAttachment[]>();
  for (const attachment of tripAttachments) {
    if (attachment.item_type === "expense" && attachment.item_id) {
      const list = attachmentsByExpenseId.get(attachment.item_id) ?? [];
      list.push(attachment);
      attachmentsByExpenseId.set(attachment.item_id, list);
    }
  }
  const reservationForExpense = new Map(
    tripReservations.filter((r) => r.expense_id).map((r) => [r.expense_id as string, r]),
  );
  const taskForExpense = new Map(
    allTasks.filter((task) => task.expense_id).map((task) => [task.expense_id as string, task]),
  );
  const sharesByExpense = new Map<string, ExpenseShare[]>();
  for (const share of (expenseShares ?? []) as ExpenseShare[]) {
    const shares = sharesByExpense.get(share.expense_id) ?? [];
    shares.push(share);
    sharesByExpense.set(share.expense_id, shares);
  }
  // A reservation's "responsible people" (#205) live only on its linked
  // expense's shares, not on trip_reservations itself.
  const responsibleIdsByReservation = new Map<string, string[]>(
    tripReservations
      .filter((reservation) => reservation.expense_id)
      .map((reservation) => [
        reservation.id,
        (sharesByExpense.get(reservation.expense_id as string) ?? []).map((share) => share.user_id),
      ]),
  );
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
  const expenseSummaryRows = ((expenseSummary ?? []) as ExpenseSummaryRow[])
    .map((row) => {
      const estimatedTotal = Number(row.estimated_total);
      const paidTotal = Number(row.paid_total);
      const toPayTotal = Number(row.to_pay_total);
      const consumedTotal = paidTotal + toPayTotal;
      const difference = consumedTotal - estimatedTotal;
      const percentUsed = estimatedTotal > 0 ? Math.round((consumedTotal / estimatedTotal) * 100) : null;
      return {
        currency: row.currency,
        estimatedTotal,
        paidTotal,
        toPayTotal,
        difference,
        percentUsed,
      };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
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
  const yourShareByCurrency = new Map<string, number>();
  for (const row of balanceRows) {
    if (row.user_id === user.id) {
      yourShareByCurrency.set(row.currency, Number(row.total_owed));
    }
  }
  const expenseOverviewByCurrency = totalsByCurrency.map(([currency, total]) => {
    const yourShare = yourShareByCurrency.get(currency) ?? 0;
    const percentOfTotal = total > 0 ? Math.round((yourShare / total) * 100) : 0;
    return { currency, total, yourShare, percentOfTotal };
  });
  const categoryChartDataByCurrency = new Map<string, ExpenseCategoryChartDatum[]>();
  for (const expense of tripExpenses) {
    const amount = Number(expense.amount ?? expense.estimated_amount ?? 0);
    if (!amount) {
      continue;
    }
    const label = expenseCategoryLabels[expense.category as keyof typeof expenseCategoryLabels] ?? expense.category;
    const list = categoryChartDataByCurrency.get(expense.currency) ?? [];
    const existing = list.find((datum) => datum.category === label);
    if (existing) {
      existing.amount += amount;
    } else {
      list.push({ category: label, amount });
    }
    categoryChartDataByCurrency.set(expense.currency, list);
  }
  for (const list of categoryChartDataByCurrency.values()) {
    list.sort((a, b) => b.amount - a.amount);
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
  const buildExpenseGroups = (
    keyOf: (expense: TripExpense) => string,
    labelOf: (key: string) => string,
  ) => {
    const groups = new Map<string, TripExpense[]>();
    for (const expense of tripExpenses) {
      const key = keyOf(expense);
      const list = groups.get(key) ?? [];
      list.push(expense);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .map(([key, groupExpenses]) => ({
        key,
        label: labelOf(key),
        expenses: groupExpenses,
        subtotalsByCurrency: Array.from(
          groupExpenses.reduce((totals, expense) => {
            const amount = Number(expense.amount ?? expense.estimated_amount ?? 0);
            totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + amount);
            return totals;
          }, new Map<string, number>()),
        ).sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, localeTag(locale)));
  };
  const expensesByCategory = expenseView === "category"
    ? buildExpenseGroups(
        (expense) => expense.category,
        (key) => expenseCategoryLabels[key as keyof typeof expenseCategoryLabels] ?? key,
      )
    : [];
  const expensesByPayer = expenseView === "payer"
    ? buildExpenseGroups(
        (expense) => expense.payer_id ?? "unassigned",
        (key) => (key === "unassigned" ? t("expenses.noPayerYet") : namesIncludingRemoved.get(key) ?? tCommon("traveler")),
      )
    : [];
  const commentsFor = (itemType: "itinerary" | "task", itemId: string) =>
    tripComments.filter((comment) =>
      itemType === "itinerary"
        ? comment.itinerary_item_id === itemId
        : comment.task_id === itemId,
    );
  const buildPrepQuickFilterHref = (next: { critical?: boolean; overdue?: boolean; category?: string }) => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (ownerFilter !== "all") params.set("owner", ownerFilter);
    const nextCategory = next.category ?? categoryFilter;
    if (nextCategory !== "all") params.set("category", nextCategory);
    if (dueOffsetFilter !== "all") params.set("dueOffset", String(dueOffsetFilter));
    if (next.critical ?? criticalOnlyFilter) params.set("critical", "1");
    if (next.overdue ?? overdueOnlyFilter) params.set("overdue", "1");
    params.set("tab", "preparation");
    return `/trips/${trip.id}?${params.toString()}`;
  };
  const renderExpenseRow = (expense: TripExpense) => (
    <li key={expense.id} className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">{expense.description}</h3>
            <Badge variant="secondary" className="capitalize">
              {expenseCategoryLabels[expense.category as keyof typeof expenseCategoryLabels] ?? expense.category}
            </Badge>
            {expense.payment_status === "to_pay" ? (
              <Badge className="bg-amber-100 text-amber-900">{t("expenses.paymentStatusToPay")}</Badge>
            ) : null}
            {reservationForExpense.get(expense.id) ? (
              <Link
                href={`/trips/${trip.id}?tab=reservations#reservation-${reservationForExpense.get(expense.id)!.id}`}
                className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100"
              >
                {t("expenses.originReservation")}
              </Link>
            ) : taskForExpense.get(expense.id) ? (
              <Link
                href={`/trips/${trip.id}?tab=preparation#task-${taskForExpense.get(expense.id)!.id}`}
                className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100"
              >
                {t("expenses.originTask")}
              </Link>
            ) : null}
          </div>
          <p className="mt-2 text-lg font-semibold text-emerald-800">
            {expense.amount ? formatMoney(expense.amount, expense.currency) : null}
            {expense.estimated_amount ? (
              <span className="ml-2 text-sm font-normal text-slate-500">
                {t("expenses.estimatedInline", { amount: formatMoney(expense.estimated_amount, expense.currency) })}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {expense.payer_id
              ? t("expenses.paidBy", { name: namesIncludingRemoved.get(expense.payer_id) ?? tCommon("traveler") })
              : t("expenses.noPayerYet")}
            {" · "}{formatDate(expense.expense_date)}
          </p>
          {sharesByExpense.get(expense.id)?.length ? (
            <p className="mt-2 text-sm text-slate-600">
              {t("expenses.split", {
                details: sharesByExpense.get(expense.id)!
                  .map((share) => `${namesIncludingRemoved.get(share.user_id) ?? tCommon("traveler")} ${formatMoney(share.share_amount, expense.currency)}`)
                  .join(" · "),
              })}
            </p>
          ) : null}
        </div>
        {!isArchived ? (
          <ItemActionsMenu
            editLabel={t("expenses.editExpense")}
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
            deleteTitle={t("expenses.deleteExpenseTitle")}
            deleteDescription={t("expenses.deleteExpenseDescription", { description: expense.description })}
          />
        ) : null}
      </div>
      {(attachmentsByExpenseId.get(expense.id) ?? []).length ? (
        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {(attachmentsByExpenseId.get(expense.id) ?? []).map((attachment) => (
            <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">
                {attachment.file_name} <span className="text-xs text-slate-500">({formatFileSize(attachment.size_bytes)})</span>
              </span>
              <span className="flex items-center gap-3">
                {attachment.downloadUrl ? (
                  <a href={attachment.downloadUrl} className="font-semibold text-sky-700 hover:text-sky-800">
                    {t("documents.download")}
                  </a>
                ) : (
                  <span className="text-xs text-red-800">{t("documents.linkUnavailable")}</span>
                )}
                {!isArchived ? (
                  <ConfirmDeleteForm
                    action={deleteAttachment}
                    hiddenFields={{ tripId: trip.id, attachmentId: attachment.id, storagePath: attachment.storage_path }}
                    title={t("documents.deleteAttachmentTitle")}
                    description={t("documents.deleteAttachmentDescription", { fileName: attachment.file_name })}
                    triggerLabel={t("documents.delete")}
                    triggerClassName="h-auto p-0 text-destructive"
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!isArchived ? (
        <CollapsibleFormPanel
          variant="inline"
          trigger={t("expenses.addReceipt")}
          detailsClassName="mt-3 border-t border-slate-100 pt-3"
          summaryClassName="text-sm font-semibold text-sky-700 hover:text-sky-800"
          triggerClassName="mt-3 text-sm"
        >
          <div className="mt-3">
            <AttachmentForm
              tripId={trip.id}
              fixedAssociation={{ itemType: "expense", itemId: expense.id }}
              compact
            />
          </div>
        </CollapsibleFormPanel>
      ) : null}
    </li>
  );
  const buildExpenseViewHref = (view: "all" | "category" | "payer") => {
    const params = new URLSearchParams();
    if (view !== "all") params.set("expenseView", view);
    params.set("tab", "expenses");
    return `/trips/${trip.id}?${params.toString()}`;
  };
  const validTabs = ["overview", "itinerary", "reservations", "expenses", "preparation", "documents", "organizer"];
  const defaultTab = validTabs.includes(filters.tab ?? "")
    ? (filters.tab as string)
    : filters.status || filters.owner || filters.category || criticalOnlyFilter || overdueOnlyFilter
      ? "preparation"
      : filters.expenseView
        ? "expenses"
        : filters.city || filters.period
          ? "itinerary"
          : "overview";
  const upcomingTasksPreview = allTasks
    .filter((task) => !task.completed_at)
    .sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99"))
    .slice(0, 3);
  const recentComments = [...tripComments]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((comment) => {
      const sourceId = comment.item_type === "itinerary" ? comment.itinerary_item_id : comment.task_id;
      const sourceTitle = sourceId
        ? (comment.item_type === "itinerary" ? itineraryTitles : taskTitles).get(sourceId)
        : undefined;
      const sourceTab = comment.item_type === "itinerary" ? "itinerary" : "preparation";
      return {
        ...comment,
        sourceTitle: sourceTitle ?? t("overview.removedItem"),
        sourceHref: sourceId
          ? `/trips/${trip.id}?tab=${sourceTab}#${comment.item_type}-${sourceId}`
          : `/trips/${trip.id}?tab=${sourceTab}`,
      };
    });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 standalone:px-4 standalone:pt-3">
      <div className="mx-auto max-w-4xl space-y-8">
        <Card className="[--card-spacing:--spacing(8)] sm:[--card-spacing:--spacing(10)]">
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not an optimizable static/remote asset
              <img
                src={coverImageUrl}
                alt={tCoverImage("alt", { destination: trip.destination })}
                className="h-48 w-full object-cover sm:h-64"
              />
            ) : null}
          <CardContent>
            <Link
              href="/trips"
              className="text-sm font-semibold text-primary hover:text-primary/80"
            >
              {t("backToTrips")}
            </Link>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                {t("eyebrow")}
              </p>
              <div className="flex items-center gap-3 standalone:sticky standalone:top-0 standalone:z-40 standalone:rounded-lg standalone:bg-card/95 standalone:px-2 standalone:py-1 standalone:backdrop-blur">
                <RealtimeStatus tripId={trip.id} />
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              {trip.title}
            </h1>
            {tripDestinations.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {tripDestinations.map((destination) => (
                  <li key={destination.id}>
                    <Badge variant="outline" className="bg-card">
                      {destination.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
            {countdownLabel && !isArchived ? (
              <p className="mt-2 text-sm font-medium text-primary">{countdownLabel}</p>
            ) : null}

            {isTripOrganizer && !isArchived ? (
              <div className="mt-4">
                <CoverImageForm tripId={trip.id} hasCoverImage={Boolean(trip.cover_image_path)} />
              </div>
            ) : null}

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-5">
                <dt className="text-sm font-medium text-slate-500">{t("startDate")}</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-950">
                  {formatDate(trip.start_date)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <dt className="text-sm font-medium text-slate-500">{t("endDate")}</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-950">
                  {trip.end_date ? formatDate(trip.end_date) : t("endDateUndefined")}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <dt className="text-sm font-medium text-slate-500">{t("timezone")}</dt>
                <dd className="mt-2 text-lg font-semibold text-slate-950">
                  {trip.timezone}
                </dd>
              </div>
            </dl>

            {filters.tripError === "delete_not_allowed" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("errors.delete_not_allowed")}
              </p>
            ) : null}

            {filters.tripError === "cannot_remove_self" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("errors.cannot_remove_self")}
              </p>
            ) : null}

            {filters.tripError === "remove_participant_not_allowed" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("errors.remove_participant_not_allowed")}
              </p>
            ) : null}

            {filters.tripError === "resend_invitation_not_allowed" || filters.tripError === "cancel_invitation_not_allowed" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("errors.invitation_not_allowed")}
              </p>
            ) : null}

            {filters.tripError === "archive_not_allowed" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("errors.archive_not_allowed")}
              </p>
            ) : null}

            {isArchived ? (
              <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t("archivedNotice")}
              </p>
            ) : null}

            {isCreator ? (
              <div className="mt-8 border-t border-slate-200 pt-6">
                <CollapsibleFormPanel
                  variant="inline"
                  trigger={t("editTrip")}
                  detailsClassName="rounded-2xl bg-slate-50 p-5"
                >
                  <TripForm
                    trip={{
                      id: trip.id,
                      title: trip.title,
                      start_date: trip.start_date,
                      end_date: trip.end_date,
                      timezone: trip.timezone,
                      destinations: tripDestinations.map((destination) => ({
                        label: destination.label,
                        city: destination.city,
                        country: destination.country,
                        continent: destination.continent,
                        granularity: destination.granularity,
                      })),
                    }}
                  />
                </CollapsibleFormPanel>
                <div className="mt-4 flex justify-end gap-4">
                  <form action={isArchived ? restoreTrip : archiveTrip}>
                    <input type="hidden" name="tripId" value={trip.id} />
                    <SubmitButton
                      pendingLabel={isArchived ? t("reactivatingPending") : t("archivingPending")}
                      variant="outline"
                      size="sm"
                    >
                      {isArchived ? t("reactivate") : t("archive")}
                    </SubmitButton>
                  </form>
                  <ConfirmDeleteForm
                    action={deleteTrip}
                    hiddenFields={{ tripId: trip.id }}
                    title={t("deleteTripTitle")}
                    description={t("deleteTripDescription", { destination: trip.destination })}
                    triggerLabel={t("deleteTrip")}
                    triggerClassName="h-auto p-0 text-destructive"
                  />
                </div>
              </div>
            ) : null}

            {commentsError ? (
              <p role="alert" className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {t("commentsLoadError")}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Tabs defaultValue={defaultTab}>
          {/* Equal-width flex-1 tabs (the shared component's default) have a
              default min-width of auto, so they won't shrink below their
              label's natural width. That's fine at today's label lengths on
              a 393px viewport (verified below), but scroll-instead-of-clip
              is one line of defense against a longer label (a 5th tab, or a
              future English translation) quietly pushing the bar - and by
              extension the page - wider than the screen. */}
          <TabsList className="w-full overflow-x-auto sm:w-auto sm:overflow-visible standalone:sticky standalone:top-0 standalone:z-30 standalone:w-full standalone:justify-start standalone:rounded-none standalone:border-b standalone:border-slate-200 standalone:bg-slate-50/95 standalone:py-2 standalone:backdrop-blur">
            <TabsTrigger value="overview" className="shrink-0 sm:flex-1 sm:shrink">{t("tabs.overview")}</TabsTrigger>
            <TabsTrigger value="itinerary" className="shrink-0 sm:flex-1 sm:shrink">{t("tabs.itinerary")}</TabsTrigger>
            <TabsTrigger value="reservations" className="shrink-0 sm:flex-1 sm:shrink">{t("tabs.reservations")}</TabsTrigger>
            <TabsTrigger value="expenses" className="shrink-0 sm:flex-1 sm:shrink">{t("tabs.expenses")}</TabsTrigger>
            <TabsTrigger value="preparation" className="shrink-0 sm:flex-1 sm:shrink">{t("tabs.preparation")}</TabsTrigger>
            <TabsTrigger value="documents" className="shrink-0 sm:flex-1 sm:shrink">{t("tabs.documents")}</TabsTrigger>
            {isCreator ? <TabsTrigger value="organizer" className="shrink-0 sm:flex-1 sm:shrink">{t("tabs.organizer")}</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="overview">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle className="text-2xl">{t("overview.title")}</CardTitle>
              <CardDescription>
                {t("overview.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <section className="overflow-hidden rounded-2xl border border-sky-100 bg-sky-50 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-sky-800">{t("readiness.title")}</p>
                    <p className="mt-1 text-3xl font-semibold text-sky-950">{readiness}%</p>
                  </div>
                  <p className="text-right text-sm text-sky-800">{t("readiness.completedCount", { completed: completedTaskCount, total: allTasks.length })}</p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-background" aria-label={t("readiness.ariaLabel", { percent: readiness })} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness}>
                  <div className="h-full rounded-full bg-sky-600" style={{ width: `${readiness}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-card">{t("readiness.criticalOpen", { count: criticalOpenCount })}</Badge>
                  <Badge variant="outline" className={overdueTaskCount ? "border-red-200 bg-red-100 text-red-800" : "bg-card"}>{t("readiness.overdue", { count: overdueTaskCount })}</Badge>
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-950">{t("overview.upcomingStepsTitle")}</h3>
                  <Link href={`/trips/${trip.id}?tab=preparation`} className="text-sm font-semibold text-primary hover:text-primary/80">
                    {t("overview.viewFullPreparation")}
                  </Link>
                </div>
                {upcomingTasksPreview.length ? (
                  <ul className="mt-3 space-y-3">
                    {upcomingTasksPreview.map((task) => (
                      <li key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-sm">
                        <span className="font-medium text-slate-900">{task.title}</span>
                        <span className="text-slate-500">{task.due_date ? formatDate(task.due_date) : t("overview.noDueDate")}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">{t("overview.noPendingTasks")}</p>
                )}
              </section>

              <section>
                <h3 className="text-lg font-semibold text-slate-950">{t("overview.participantsTitle")}</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {tripParticipants.map((participant) => (
                    <li key={participant.user_id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
                      <span className="text-slate-800">{participant.display_name}</span>
                      <Badge variant="outline" className="capitalize">
                        {participant.role === "organizer" ? t("overview.roleOrganizer") : t("overview.roleTraveler")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-slate-950">{t("overview.guideTitle")}</h3>
                {trip.destination_guide_content ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 p-4 text-sm">
                    <p className="whitespace-pre-wrap text-slate-800">{trip.destination_guide_content}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      {trip.destination_guide_source ? t("overview.guideSource", { source: trip.destination_guide_source }) : null}
                      {trip.destination_guide_source && trip.destination_guide_reviewed_at ? " · " : ""}
                      {trip.destination_guide_reviewed_at ? t("overview.guideReviewed", { date: formatDate(trip.destination_guide_reviewed_at) }) : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">{t("overview.guideEmpty")}</p>
                )}
                {canEditDestinationGuide && !isArchived ? (
                  <CollapsibleFormPanel
                    variant="inline"
                    trigger={trip.destination_guide_content ? t("overview.guideEdit") : t("overview.guideAdd")}
                    defaultOpen={!trip.destination_guide_content}
                    detailsClassName="mt-4 rounded-2xl bg-slate-50 p-5"
                  >
                    <div className="mt-5">
                      <DestinationGuideForm
                        tripId={trip.id}
                        guide={{
                          content: trip.destination_guide_content,
                          source: trip.destination_guide_source,
                          reviewedAt: trip.destination_guide_reviewed_at,
                        }}
                      />
                    </div>
                  </CollapsibleFormPanel>
                ) : null}
              </section>

              <section>
                <h3 className="text-lg font-semibold text-slate-950">{t("overview.activityTitle")}</h3>
                {recentComments.length ? (
                  <ul className="mt-3 space-y-3">
                    {recentComments.map((comment) => (
                      <li key={comment.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                        <p className="text-slate-600">
                          <span className="font-semibold text-slate-900">
                            {participantNames.get(comment.author_id) ?? tCommon("traveler")}
                          </span>{" "}
                          {t("overview.commentedOn")}{" "}
                          <Link href={comment.sourceHref} className="font-semibold text-primary hover:text-primary/80">
                            {comment.sourceTitle}
                          </Link>
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-slate-800">{comment.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">{t("overview.noComments")}</p>
                )}
              </section>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="itinerary">
          <ItineraryTab
            tripId={trip.id}
            tripTitle={trip.title}
            isArchived={isArchived}
            currentUserId={user.id}
            itineraryItems={itineraryItems ?? []}
            itineraryError={Boolean(itineraryError)}
            activitySuggestions={tripActions}
            reservationsByItineraryItemId={reservationsByItineraryItemId}
            tasksByItineraryItemId={tasksByItineraryItemId}
            commentsFor={commentsFor}
            participantNames={participantNames}
            catalogTemplates={catalogTemplates}
            appliedItineraryTemplateIds={appliedItineraryTemplateIds}
            taskCategoryLabels={taskCategoryLabels}
            prepItemTypeLabels={prepItemTypeLabels}
            classificationLabels={classificationLabels}
            continentLabels={continentLabels}
            itineraryPeriodLabels={itineraryPeriodLabels}
            tripDestinations={tripDestinations}
            cityFilter={cityFilter}
            itineraryPeriodFilter={itineraryPeriodFilter}
            tripStartDate={trip.start_date}
            tripLastDay={trip.end_date ?? trip.start_date}
            today={today}
            t={t}
            formatDate={formatDate}
            formatWeekday={formatWeekday}
            formatItineraryWhen={formatItineraryWhen}
          />
          </TabsContent>

          <TabsContent value="reservations">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle className="text-2xl">{t("itinerary.reservationsTitle")}</CardTitle>
              <CardDescription>
                {t("itinerary.reservationsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isArchived ? (
                <CollapsibleFormPanel
                  trigger={t("itinerary.addReservation")}
                  defaultOpen={!tripReservations.length}
                  detailsClassName="mt-5 rounded-2xl bg-sky-50 p-5"
                  summaryClassName="text-sky-900"
                >
                  <div className="mt-5">
                    <ReservationForm itineraryItems={itineraryItemOptions} participants={tripParticipants} tripId={trip.id} />
                  </div>
                </CollapsibleFormPanel>
              ) : null}

              {reservationsError ? (
                <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  {t("itinerary.reservationsLoadError")}
                </p>
              ) : tripReservations.length ? (
                <ol className="mt-6 space-y-4">
                  {tripReservations.map((reservation) => (
                    <li id={`reservation-${reservation.id}`} key={reservation.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={reservationBadgeVariant[reservation.reservation_type]}>
                              {reservationTypeLabels[reservation.reservation_type]}
                            </Badge>
                            <p className="text-sm font-semibold text-sky-700">
                              {formatReservationWhen(reservation)}
                            </p>
                          </div>
                          <h3 className="mt-2 text-lg font-semibold text-slate-950">{reservation.title}</h3>
                          {reservation.provider ? (
                            <p className="mt-1 text-sm text-slate-600">{reservation.provider}</p>
                          ) : null}
                          {reservation.location || reservation.destination_location ? (
                            <p className="mt-1 text-sm text-slate-600">
                              {[reservation.location, reservation.destination_location]
                                .filter(Boolean)
                                .join(" → ")}
                            </p>
                          ) : null}
                          {reservation.confirmation_code ? (
                            <p className="mt-2 text-sm text-slate-600">
                              {t("itinerary.confirmation")} <ConfirmationCode code={reservation.confirmation_code} />
                            </p>
                          ) : null}
                          {reservation.itinerary_item_id && itineraryTitles.get(reservation.itinerary_item_id) ? (
                            <p className="mt-2 text-sm text-slate-600">
                              {t("itinerary.linkedToItemPrefix")}{" "}
                              <Link
                                href={`/trips/${trip.id}?tab=itinerary#itinerary-${reservation.itinerary_item_id}`}
                                className="font-semibold text-sky-700 hover:text-sky-800"
                              >
                                {itineraryTitles.get(reservation.itinerary_item_id)}
                              </Link>{" "}
                              {t("itinerary.linkedToItemSuffix")}
                            </p>
                          ) : null}
                          {reservation.paid_amount && reservation.currency ? (
                            <p className="mt-2 text-sm text-slate-600">
                              {(() => {
                                const responsibleNames = (responsibleIdsByReservation.get(reservation.id) ?? [])
                                  .map((id) => namesIncludingRemoved.get(id) ?? tCommon("traveler"))
                                  .join(", ");
                                const amount = formatMoney(reservation.paid_amount as string, reservation.currency as string);
                                return reservation.payment_status === "to_pay"
                                  ? t("itinerary.reservationToPay", { amount, responsible: responsibleNames })
                                  : t("itinerary.reservationPaid", { amount, responsible: responsibleNames });
                              })()}
                              {reservation.expense_id ? ` · ${t("itinerary.reservationExpenseLinked")}` : ""}
                            </p>
                          ) : null}
                          {reservation.notes ? (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{reservation.notes}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-sky-700">
                            <a
                              href={`/api/trips/${trip.id}/reservations/${reservation.id}/ics`}
                              download
                              className="hover:text-sky-800"
                            >
                              {t("itinerary.addReservationToCalendar")}
                            </a>
                            {reservation.location || reservation.destination_location ? (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                  reservation.location ?? reservation.destination_location ?? "",
                                )}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="hover:text-sky-800"
                              >
                                {t("itinerary.viewReservationOnMap")}
                              </a>
                            ) : null}
                          </div>
                        </div>
                        {!isArchived ? (
                          <ItemActionsMenu
                            editLabel={t("itinerary.editReservation")}
                            editForm={
                              <ReservationForm
                                itineraryItems={itineraryItemOptions}
                                participants={tripParticipants}
                                reservation={{
                                  ...reservation,
                                  responsible_ids: responsibleIdsByReservation.get(reservation.id) ?? [],
                                }}
                                tripId={trip.id}
                              />
                            }
                            deleteAction={deleteReservation}
                            deleteHiddenFields={{ tripId: trip.id, reservationId: reservation.id }}
                            deleteTitle={t("itinerary.deleteReservationTitle")}
                            deleteDescription={t("itinerary.deleteReservationDescription", { title: reservation.title })}
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                  {t("itinerary.reservationsEmpty")}
                </p>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="expenses">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle className="text-2xl">{t("expenses.title")}</CardTitle>
              <CardDescription>
                {t("expenses.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expenseOverviewByCurrency.length ? (
                <div className="space-y-4">
                  {expenseOverviewByCurrency.map((overview) => (
                    <dl key={overview.currency} className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-emerald-50 p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t("expenses.totalLabel", { currency: overview.currency })}</dt>
                        <dd className="mt-1 text-xl font-semibold text-emerald-950">{formatMoney(overview.total, overview.currency)}</dd>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t("expenses.yourShareLabel")}</dt>
                        <dd className="mt-1 text-xl font-semibold text-emerald-950">{formatMoney(overview.yourShare, overview.currency)}</dd>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 p-4">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t("expenses.percentOfGroupLabel")}</dt>
                        <dd className="mt-1 text-xl font-semibold text-emerald-950">{t("expenses.percentValue", { percent: overview.percentOfTotal })}</dd>
                      </div>
                    </dl>
                  ))}
                </div>
              ) : null}

              {categoryChartDataByCurrency.size ? (
                <div className="mt-6 space-y-6">
                  <h3 className="text-lg font-semibold text-slate-950">{t("expenses.chartTitle")}</h3>
                  {Array.from(categoryChartDataByCurrency.entries()).map(([currency, data]) => (
                    <div key={currency} className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{currency}</p>
                      <div className="mt-3">
                        <ExpenseCategoryChart
                          data={data}
                          currency={currency}
                          localeTag={localeTag(locale)}
                          chartLabel={t("expenses.chartAriaLabel", { currency })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {expenseSummaryRows.length ? (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-950">{t("expenses.summaryTitle")}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {expenseSummaryRows.map((row) => {
                      const diffCents = Math.round(row.difference * 100);
                      const budgetState =
                        row.percentUsed === null
                          ? "noEstimate"
                          : diffCents > 0
                            ? "over"
                            : diffCents < 0
                              ? "under"
                              : "on";
                      return (
                        <div key={row.currency} className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.currency}</p>
                          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <dt className="text-xs text-slate-500">{t("expenses.summaryEstimated")}</dt>
                              <dd className="font-semibold text-slate-900">{formatMoney(row.estimatedTotal, row.currency)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-slate-500">{t("expenses.summaryPaid")}</dt>
                              <dd className="font-semibold text-slate-900">{formatMoney(row.paidTotal, row.currency)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-slate-500">{t("expenses.summaryToPay")}</dt>
                              <dd className="font-semibold text-slate-900">{formatMoney(row.toPayTotal, row.currency)}</dd>
                            </div>
                          </dl>
                          {budgetState === "noEstimate" ? (
                            <p className="mt-3 text-sm text-slate-500">{t("expenses.summaryNoEstimate")}</p>
                          ) : (
                            <p
                              className={`mt-3 text-sm font-medium ${
                                budgetState === "over"
                                  ? "text-red-700"
                                  : budgetState === "under"
                                    ? "text-emerald-700"
                                    : "text-slate-700"
                              }`}
                            >
                              {budgetState === "over"
                                ? t("expenses.summaryOverBudget")
                                : budgetState === "under"
                                  ? t("expenses.summaryUnderBudget")
                                  : t("expenses.summaryOnBudget")}
                              {" · "}
                              {t("expenses.summaryDifference", { amount: formatMoney(row.difference, row.currency) })}
                              {" · "}
                              {t("expenses.summaryPercentUsed", { percent: row.percentUsed ?? 0 })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {balancesByCurrency.size ? (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-950">{t("expenses.balancesTitle")}</h3>
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
                                  ? t("expenses.balanceReceives", { amount: formatMoney(row.net_balance, currency) })
                                  : netCents < 0
                                    ? t("expenses.balanceOwes", { amount: formatMoney((-Number(row.net_balance)).toFixed(2), currency) })
                                    : t("expenses.balanceSettled")}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {(settlementsByCurrency.get(currency) ?? []).length ? (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("expenses.settlementSuggestion")}</p>
                          <ul className="mt-2 space-y-2 text-sm text-slate-700">
                            {(settlementsByCurrency.get(currency) ?? []).map((settlement) => (
                              <li key={`${settlement.fromUserId}-${settlement.toUserId}`} className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  {t("expenses.settlementLine", {
                                    from: settlement.fromDisplayName,
                                    amount: formatMoney(settlement.amount, currency),
                                    to: settlement.toDisplayName,
                                  })}
                                </span>
                                {settlement.toUserId === user.id ? (
                                  <RemindBalanceButton tripId={trip.id} debtorUserId={settlement.fromUserId} currency={currency} />
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-500">{t("expenses.allSettled")}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {!isArchived ? (
                <CollapsibleFormPanel
                  trigger={t("expenses.addExpense")}
                  defaultOpen={!tripExpenses.length}
                  detailsClassName="mt-5 rounded-2xl bg-sky-50 p-5"
                  summaryClassName="text-sky-900"
                >
                  <div className="mt-5">
                    <ExpenseForm participants={tripParticipants} tripId={trip.id} />
                  </div>
                </CollapsibleFormPanel>
              ) : null}

              {expensesError ? (
                <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  {t("expenses.loadError")}
                </p>
              ) : tripExpenses.length ? (
                <>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {([
                      { view: "all", label: t("expenses.viewAll") },
                      { view: "category", label: t("expenses.viewByCategory") },
                      { view: "payer", label: t("expenses.viewByPayer") },
                    ] as const).map((option) => (
                      <Link
                        key={option.view}
                        href={buildExpenseViewHref(option.view)}
                        aria-current={expenseView === option.view ? "true" : undefined}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                          expenseView === option.view
                            ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {option.label}
                      </Link>
                    ))}
                  </div>

                  {expenseView === "all" ? (
                    <ul className="mt-4 space-y-4">
                      {tripExpenses.map((expense) => renderExpenseRow(expense))}
                    </ul>
                  ) : (
                    <div className="mt-4 space-y-6">
                      {(expenseView === "category" ? expensesByCategory : expensesByPayer).map((group) => (
                        <section key={group.key}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{group.label}</h3>
                            <p className="text-xs font-medium text-slate-500">
                              {group.subtotalsByCurrency
                                .map(([currency, total]) => formatMoney(total, currency))
                                .join(" · ")}
                            </p>
                          </div>
                          <ul className="mt-3 space-y-4">
                            {group.expenses.map((expense) => renderExpenseRow(expense))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                  {t("expenses.empty")}
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
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("preparation.eyebrow")}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{t("preparation.title")}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t("preparation.description")}
                  </p>
                </div>
                {!isArchived ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <AddTaskFromCatalogModal
                      templates={catalogTemplates}
                      tripId={trip.id}
                      taskCategoryLabels={taskCategoryLabels}
                      prepItemTypeLabels={prepItemTypeLabels}
                      classificationLabels={classificationLabels}
                      continentLabels={continentLabels}
                      appliedTemplateIds={appliedTemplateIds}
                    />
                    <NewTaskModal
                      triggerLabel={t("preparation.createTask")}
                      tripId={trip.id}
                      existingTemplateActions={existingTemplateActions}
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-sky-800">{t("readiness.title")}</p>
                    <p className="mt-1 text-3xl font-semibold text-sky-950">{readiness}%</p>
                  </div>
                  <p className="text-right text-sm text-sky-800">{t("readiness.completedCount", { completed: completedTaskCount, total: allTasks.length })}</p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-background" aria-label={t("readiness.ariaLabel", { percent: readiness })} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness}>
                  <div className="h-full rounded-full bg-sky-600" style={{ width: `${readiness}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-card">{t("readiness.criticalOpen", { count: criticalOpenCount })}</Badge>
                  <Badge variant="outline" className={overdueTaskCount ? "border-red-200 bg-red-100 text-red-800" : "bg-card"}>{t("readiness.overdue", { count: overdueTaskCount })}</Badge>
                </div>
              </div>

              {readinessByCategory.length ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {readinessByCategory.map((row) => (
                    <div key={row.category} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                        <p className="text-xs font-medium text-slate-500">
                          {t("readiness.completedCount", { completed: row.completed, total: row.total })}
                        </p>
                      </div>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-label={t("readiness.categoryAriaLabel", { category: row.label, percent: row.percent })}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={row.percent}
                      >
                        <div className="h-full rounded-full bg-sky-600" style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {readinessByCategory.length ? (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("preparation.categoryQuickFilterTitle")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={buildPrepQuickFilterHref({ category: "all" })}
                      aria-current={categoryFilter === "all" ? "true" : undefined}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        categoryFilter === "all"
                          ? "border-sky-300 bg-sky-100 text-sky-900"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {t("preparation.categoryAll")} ({allTasks.length})
                    </Link>
                    {readinessByCategory.map((row) => (
                      <Link
                        key={row.category}
                        href={buildPrepQuickFilterHref({ category: row.category === categoryFilter ? "all" : row.category })}
                        aria-current={categoryFilter === row.category ? "true" : undefined}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                          categoryFilter === row.category
                            ? "border-sky-300 bg-sky-100 text-sky-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {row.label} ({row.total})
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href={buildPrepQuickFilterHref({ critical: !criticalOnlyFilter })}
                  aria-current={criticalOnlyFilter ? "true" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    criticalOnlyFilter
                      ? "border-amber-300 bg-amber-100 text-amber-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {t("preparation.criticalOnly")}
                </Link>
                <Link
                  href={buildPrepQuickFilterHref({ overdue: !overdueOnlyFilter })}
                  aria-current={overdueOnlyFilter ? "true" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    overdueOnlyFilter
                      ? "border-red-300 bg-red-100 text-red-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {t("preparation.overdueOnly")}
                </Link>
              </div>

              <form className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-4">
                <input type="hidden" name="tab" value="preparation" />
                {criticalOnlyFilter ? <input type="hidden" name="critical" value="1" /> : null}
                {overdueOnlyFilter ? <input type="hidden" name="overdue" value="1" /> : null}
                <div className="space-y-1.5">
                  <Label htmlFor="status-filter" className="text-slate-700">{t("preparation.statusLabel")}</Label>
                  <Select
                    name="status"
                    defaultValue={statusFilter}
                    items={{
                      all: t("preparation.statusAll"),
                      open: t("preparation.statusOpen"),
                      completed: t("preparation.statusCompleted"),
                    }}
                  >
                    <SelectTrigger id="status-filter" className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("preparation.statusAll")}</SelectItem>
                      <SelectItem value="open">{t("preparation.statusOpen")}</SelectItem>
                      <SelectItem value="completed">{t("preparation.statusCompleted")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-filter" className="text-slate-700">{t("preparation.ownerLabel")}</Label>
                  <Select
                    name="owner"
                    defaultValue={ownerFilter}
                    items={{
                      all: t("preparation.ownerAll"),
                      unassigned: t("preparation.ownerUnassigned"),
                      ...Object.fromEntries(tripParticipants.map((participant) => [participant.user_id, participant.display_name])),
                    }}
                  >
                    <SelectTrigger id="owner-filter" className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("preparation.ownerAll")}</SelectItem>
                      <SelectItem value="unassigned">{t("preparation.ownerUnassigned")}</SelectItem>
                      {tripParticipants.map((participant) => (
                        <SelectItem key={participant.user_id} value={participant.user_id}>{participant.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-filter" className="text-slate-700">{t("preparation.categoryLabel")}</Label>
                  <Select
                    name="category"
                    defaultValue={categoryFilter}
                    items={{ all: t("preparation.categoryAll"), ...taskCategoryLabels }}
                  >
                    <SelectTrigger id="category-filter" className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("preparation.categoryAll")}</SelectItem>
                      {taskCategories.map((category) => (
                        <SelectItem key={category} value={category}>{taskCategoryLabels[category]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due-offset-filter" className="text-slate-700">{t("preparation.dueOffsetLabel")}</Label>
                  <Select
                    name="dueOffset"
                    defaultValue={dueOffsetFilter === "all" ? "all" : String(dueOffsetFilter)}
                    items={{
                      all: t("preparation.dueOffsetAll"),
                      ...Object.fromEntries(timelineOffsets.map((offset) => [String(offset), timelineOffsetLabels[offset]])),
                    }}
                  >
                    <SelectTrigger id="due-offset-filter" className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("preparation.dueOffsetAll")}</SelectItem>
                      {timelineOffsets.map((offset) => (
                        <SelectItem key={offset} value={String(offset)}>{timelineOffsetLabels[offset]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" variant="outline" className="sm:col-span-4 sm:justify-self-start">{t("preparation.applyFilters")}</Button>
              </form>

              {tasksError ? (
                <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{t("preparation.loadError")}</p>
              ) : sortedTasks.length ? (
                <div className="mt-7">
                  <ul className="space-y-4">
                        {sortedTasks.map((task) => {
                          const overdue = !task.completed_at && task.due_date && task.due_date < today;
                          const upcoming = !task.completed_at && task.due_date && task.due_date >= today;
                          const isGovernedPrepItem = task.classification !== null;
                          const linkedItineraryTitle = task.itinerary_item_id
                            ? itineraryTitles.get(task.itinerary_item_id)
                            : undefined;
                          return (
                            <li id={`task-${task.id}`} key={task.id} className={`rounded-2xl border p-5 ${task.completed_at ? "border-slate-200 bg-slate-50" : overdue ? "border-red-200 bg-red-50" : upcoming ? "border-sky-200 bg-sky-50" : "border-slate-200"}`}>
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className={`font-semibold ${task.completed_at ? "text-slate-500 line-through" : "text-slate-950"}`}>
                                      {resolveActionLabel(task.action, prepItemActionLabels) ? `${resolveActionLabel(task.action, prepItemActionLabels)}: ` : ""}{task.title}
                                    </h4>
                                    <Badge variant="outline">{taskCategoryLabels[task.category]}</Badge>
                                    {isGovernedPrepItem && task.item_type === "document_request" ? (
                                      <Badge variant="outline">{prepItemTypeLabels.document_request}</Badge>
                                    ) : null}
                                    {isGovernedPrepItem && task.classification !== "required" ? (
                                      <Badge variant="outline">{classificationLabels[task.classification as Exclude<Classification, "required">]}</Badge>
                                    ) : null}
                                    {isGovernedPrepItem && !task.action ? (
                                      <Badge
                                        className="border-amber-300 bg-amber-50 text-amber-800"
                                        variant="outline"
                                        title={t("preparation.badgeNeedsActionTooltip")}
                                      >
                                        ⚠ {t("preparation.badgeNeedsAction")}
                                      </Badge>
                                    ) : null}
                                    {task.is_critical && !task.completed_at ? <Badge className="bg-amber-100 text-amber-900">{t("preparation.badgeCritical")}</Badge> : null}
                                    {overdue ? <Badge className="bg-red-100 text-red-800">{t("preparation.badgeOverdue")}</Badge> : null}
                                    {upcoming ? <Badge className="bg-sky-100 text-sky-800">{t("preparation.badgeUpcoming")}</Badge> : null}
                                    {task.completed_at ? <Badge className="bg-emerald-100 text-emerald-800">{t("preparation.badgeCompleted")}</Badge> : null}
                                  </div>
                                  <p className="mt-2 text-sm text-slate-600">
                                    {participantNames.get(task.owner_id ?? "") ?? t("preparation.noOwner")}
                                    {task.due_date ? ` · ${t("preparation.dueDate", { date: formatDate(task.due_date) })}` : ` · ${t("preparation.noDueDate")}`}
                                    {task.due_offset_days !== null ? ` · ${t("preparation.daysBeforeDeparture", { count: task.due_offset_days })}` : ""}
                                  </p>
                                  {isGovernedPrepItem ? (
                                    <p className="mt-1 text-sm text-slate-600">
                                      {[continentLabels[task.continent as Continent], task.country, task.city]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                  ) : null}
                                  {isGovernedPrepItem && task.item_type === "document_request" && task.document_instructions ? (
                                    <p className="mt-2 rounded-xl bg-white p-3 text-sm text-slate-700">
                                      {task.document_instructions}
                                    </p>
                                  ) : null}
                                  {linkedItineraryTitle ? (
                                    <p className="mt-2 text-sm text-slate-600">
                                      {t("preparation.linkedItinerary", { title: linkedItineraryTitle })}
                                    </p>
                                  ) : null}
                                  {isGovernedPrepItem && task.estimated_amount && task.paid_amount ? (
                                    <p className="mt-2 text-xs text-slate-500">
                                      {task.expense_id
                                        ? t("preparation.expenseLinked")
                                        : t("preparation.expenseWillLink")}
                                    </p>
                                  ) : null}
                                  {task.reference_url ? (
                                    <a href={task.reference_url} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-800">
                                      {task.reference_label ?? t("preparation.openReference")} ↗
                                    </a>
                                  ) : null}
                                </div>
                                {!isArchived ? (
                                  <div className="flex items-center gap-2">
                                    {isGovernedPrepItem ? (
                                      <TaskCompletionDialog
                                        tripId={trip.id}
                                        taskId={task.id}
                                        completed={Boolean(task.completed_at)}
                                        title={task.title}
                                        category={task.category}
                                        city={task.city}
                                        currency={task.currency}
                                        estimatedAmount={task.estimated_amount}
                                        paidAmount={task.paid_amount}
                                        participants={tripParticipants}
                                        completeLabel={t("preparation.complete")}
                                        completingLabel={t("preparation.completingPending")}
                                        reopenLabel={t("preparation.reopen")}
                                        reopeningLabel={t("preparation.reopeningPending")}
                                        activitySuggestions={tripActions}
                                      />
                                    ) : (
                                      <form action={setTaskCompletion}>
                                        <input type="hidden" name="tripId" value={trip.id} />
                                        <input type="hidden" name="taskId" value={task.id} />
                                        <input type="hidden" name="completed" value={task.completed_at ? "false" : "true"} />
                                        <SubmitButton
                                          pendingLabel={task.completed_at ? t("preparation.reopeningPending") : t("preparation.completingPending")}
                                          variant="outline"
                                          size="sm"
                                        >
                                          {task.completed_at ? t("preparation.reopen") : t("preparation.complete")}
                                        </SubmitButton>
                                      </form>
                                    )}
                                    <ItemActionsMenu
                                      editLabel={t("preparation.editTask")}
                                      editForm={
                                        isGovernedPrepItem ? (
                                          <PrepItemForm
                                            itineraryItems={itineraryItemOptions}
                                            participants={tripParticipants}
                                            task={{
                                              id: task.id,
                                              title: task.title,
                                              action: task.action,
                                              item_type: task.item_type,
                                              category: task.category,
                                              continent: task.continent as Continent,
                                              country: task.country ?? "",
                                              city: task.city,
                                              classification: task.classification as Classification,
                                              due_offset_days: task.due_offset_days ?? 0,
                                              currency: task.currency,
                                              estimated_amount: task.estimated_amount,
                                              paid_amount: task.paid_amount,
                                              document_instructions: task.document_instructions,
                                              owner_id: task.owner_id,
                                              itinerary_item_id: task.itinerary_item_id,
                                            }}
                                            tripId={trip.id}
                                            existingTemplateActions={existingTemplateActions}
                                          />
                                        ) : (
                                          <TaskForm participants={tripParticipants} task={task} tripId={trip.id} />
                                        )
                                      }
                                      deleteAction={deleteTask}
                                      deleteHiddenFields={{ tripId: trip.id, taskId: task.id }}
                                      deleteTitle={t("preparation.deleteTaskTitle")}
                                      deleteDescription={t("preparation.deleteTaskDescription", { title: task.title })}
                                      deleteLabel={t("preparation.removeTask")}
                                    />
                                  </div>
                                ) : null}
                              </div>
                              <CommentThread comments={commentsFor("task", task.id)} currentUserId={user.id} itemId={task.id} itemType="task" participantNames={participantNames} tripId={trip.id} />
                            </li>
                          );
                        })}
                  </ul>
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">{t("preparation.empty")}</p>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="documents">
          <Card className="[--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle className="text-2xl">{t("documents.title")}</CardTitle>
              <CardDescription>
                {t("documents.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isArchived ? (
                <CollapsibleFormPanel
                  trigger={t("documents.addAttachment")}
                  defaultOpen={!tripAttachments.length}
                  detailsClassName="mt-5 rounded-2xl bg-sky-50 p-5"
                  summaryClassName="text-sky-900"
                >
                  <div className="mt-5">
                    <AttachmentForm
                      tripId={trip.id}
                      itineraryItems={(itineraryItems ?? []).map((item) => ({ id: item.id, title: item.title }))}
                      tasks={allTasks.map((task) => ({ id: task.id, title: task.title }))}
                      reservations={tripReservations.map((reservation) => ({ id: reservation.id, title: reservation.title }))}
                      expenses={tripExpenses.map((expense) => ({ id: expense.id, title: expense.description }))}
                    />
                  </div>
                </CollapsibleFormPanel>
              ) : null}

              {attachmentsError ? (
                <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  {t("documents.loadError")}
                </p>
              ) : tripAttachments.length ? (
                <ol className="mt-6 space-y-4">
                  {tripAttachments.map((attachment) => (
                    <li key={attachment.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{attachment.file_name}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatFileSize(attachment.size_bytes)}
                          {attachment.item_type ? ` · ${attachmentItemLabel(attachment, itineraryTitles, taskTitles, reservationTitles, expenseTitles, attachmentItemTypeLabels, t("documents.removedItem"))}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {attachment.downloadUrl ? (
                          <a
                            href={attachment.downloadUrl}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            {t("documents.download")}
                          </a>
                        ) : (
                          <span className="text-sm text-red-800">{t("documents.linkUnavailable")}</span>
                        )}
                        {!isArchived ? (
                          <ConfirmDeleteForm
                            action={deleteAttachment}
                            hiddenFields={{ tripId: trip.id, attachmentId: attachment.id, storagePath: attachment.storage_path }}
                            title={t("documents.deleteAttachmentTitle")}
                            description={t("documents.deleteAttachmentDescription", { fileName: attachment.file_name })}
                            triggerLabel={t("documents.delete")}
                            triggerClassName="h-auto p-0 text-destructive"
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                  {t("documents.empty")}
                </p>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          {isCreator ? (
            <TabsContent value="organizer">
              <Card className="[--card-spacing:--spacing(6)]">
                <CardHeader>
                  <CardTitle className="text-xl">{t("organizer.title")}</CardTitle>
                  <CardDescription>
                    {t("organizer.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-b border-slate-200 pb-8">
                    <h3 className="text-lg font-semibold text-slate-950">{t("organizer.participantsTitle")}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {t("organizer.participantsDescription")}
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
                                {isTripCreator
                                  ? t("organizer.roleCreator")
                                  : invitationRoleLabels[participant.role as keyof typeof invitationRoleLabels] ?? participant.role}
                              </Badge>
                            </div>
                            {!isTripCreator ? (
                              <ConfirmDeleteForm
                                action={removeParticipant}
                                hiddenFields={{ tripId: trip.id, userId: participant.user_id }}
                                title={t("organizer.removeParticipantTitle")}
                                description={t("organizer.removeParticipantDescription", { name: participant.display_name })}
                                triggerLabel={t("organizer.removeAccess")}
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="border-b border-slate-200 py-8">
                    <ShareLinkPanel tripId={trip.id} activeLink={activeShareLink} />
                  </div>

                  <div className="mt-8">
                  {canInviteParticipants ? (
                    <InviteForm tripId={trip.id} />
                  ) : (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t("organizer.inviteLockedNotice")}
                    </p>
                  )}

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
                            {" "}
                            <span className="text-xs text-slate-500">
                              ({invitationRoleLabels[invitation.role as keyof typeof invitationRoleLabels] ?? invitation.role})
                            </span>
                            {invitation.status === "pending" ? (
                              <p className="text-xs text-slate-500">
                                {t("organizer.invitationExpires", { date: formatDate(invitation.expires_at.slice(0, 10)) })}
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
                                    pendingLabel={t("organizer.resendingPending")}
                                    variant="outline"
                                    size="sm"
                                  >
                                    {t("organizer.resend")}
                                  </SubmitButton>
                                </form>
                                <ConfirmDeleteForm
                                  action={cancelInvitation}
                                  hiddenFields={{ tripId: trip.id, invitationId: invitation.id }}
                                  title={t("organizer.cancelInvitationTitle")}
                                  description={t("organizer.cancelInvitationDescription", { email: invitation.email })}
                                  triggerLabel={t("organizer.cancel")}
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
