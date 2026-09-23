import type { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CommentThread, type ItemComment } from "@/features/comments/comment-thread";
import { deleteItineraryItem, markItineraryItemReviewed } from "@/features/itinerary/actions";
import { ItineraryForm } from "@/features/itinerary/itinerary-form";
import { ItemActionsMenu } from "@/components/item-actions-menu";
import { cn } from "@/lib/utils";

type Translator = Awaited<ReturnType<typeof getTranslations<"trip">>>;

export type ItineraryItem = {
  id: string;
  item_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  period: string | null;
  city: string | null;
  approx_distance: string | null;
  // R02's new column - set true by R06's batch "add existing" flow and by
  // updateItineraryItem's own needs_review=false clear on every edit save
  // (D8); this card only renders the style + badge + "Marcar como
  // revisado" shortcut for it, not decide when it's true.
  needs_review: boolean;
  // Drives ItemActionsMenu's auto-collapse (R07): only moves once a save
  // actually lands, since updateItineraryItem bumps it and revalidatePath
  // re-renders this card with the fresh value.
  updated_at: string;
  template_id: string | null;
};

type LinkedReservation = { id: string; title: string };
type LinkedTask = { id: string; title: string; completed_at: string | null };

type ItineraryItemCardProps = {
  item: ItineraryItem;
  tripId: string;
  isArchived: boolean;
  activitySuggestions: string[];
  whenLabel: string;
  linkedReservations: LinkedReservation[];
  linkedTasks: LinkedTask[];
  comments: ItemComment[];
  currentUserId: string;
  participantNames: Map<string, string>;
  t: Translator;
};

export function ItineraryItemCard({
  item,
  tripId,
  isArchived,
  activitySuggestions,
  whenLabel,
  linkedReservations,
  linkedTasks,
  comments,
  currentUserId,
  participantNames,
  t,
}: ItineraryItemCardProps) {
  const hasDetails = Boolean(
    item.location || item.city || item.approx_distance || item.notes || linkedReservations.length || linkedTasks.length,
  );

  // "Ver" (R07): everything below the title/when-line/comment field moves
  // behind this instead of always rendering, so the collapsed card is just
  // those three things per the new design.
  const viewContent = (
    <div className="space-y-3">
      {item.location || item.city ? (
        <p className="text-sm text-slate-600">{[item.location, item.city].filter(Boolean).join(" · ")}</p>
      ) : null}
      {item.approx_distance ? (
        <p className="text-sm text-slate-600">{t("itinerary.approxDistanceLabel", { distance: item.approx_distance })}</p>
      ) : null}
      {item.notes ? <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.notes}</p> : null}
      {linkedReservations.length ? (
        <div className="flex flex-wrap gap-2">
          {linkedReservations.map((reservation) => (
            <Link
              key={reservation.id}
              href={`/trips/${tripId}?tab=reservations#reservation-${reservation.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100"
            >
              {t("itinerary.linkedReservation", { title: reservation.title })}
            </Link>
          ))}
        </div>
      ) : null}
      {linkedTasks.length ? (
        <div className="flex flex-wrap gap-2">
          {linkedTasks.map((task) => (
            <Link
              key={task.id}
              href={`/trips/${tripId}?tab=preparation#task-${task.id}`}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${task.completed_at ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
            >
              {t("itinerary.linkedTask", { title: task.title })}
            </Link>
          ))}
        </div>
      ) : null}
      {!hasDetails ? <p className="text-sm text-slate-500">{t("itinerary.noAdditionalDetails")}</p> : null}
    </div>
  );

  return (
    <li
      id={`itinerary-${item.id}`}
      className={cn(
        "rounded-2xl border p-5",
        item.needs_review ? "border-amber-300 bg-amber-50" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 text-left">
          <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{whenLabel}</p>
          {item.needs_review ? (
            <Badge className="mt-2 bg-amber-100 text-amber-900">{t("itinerary.needsReviewBadge")}</Badge>
          ) : null}
        </div>
        {!isArchived ? (
          <ItemActionsMenu
            viewLabel={t("itinerary.viewItem")}
            viewContent={viewContent}
            editLabel={t("itinerary.editItem")}
            editForm={<ItineraryForm item={item} tripId={tripId} activitySuggestions={activitySuggestions} />}
            deleteAction={deleteItineraryItem}
            deleteHiddenFields={{ tripId, itemId: item.id }}
            deleteTitle={t("itinerary.deleteItemTitle")}
            deleteDescription={t("itinerary.deleteItemDescription", { title: item.title })}
            collapseOnChangeOf={item.updated_at}
            markAsReviewedLabel={item.needs_review ? t("itinerary.markAsReviewed") : undefined}
            markAsReviewedAction={item.needs_review ? markItineraryItemReviewed : undefined}
            markAsReviewedHiddenFields={item.needs_review ? { tripId, itemId: item.id } : undefined}
          />
        ) : null}
      </div>
      <CommentThread
        comments={comments}
        currentUserId={currentUserId}
        itemId={item.id}
        itemType="itinerary"
        participantNames={participantNames}
        tripId={tripId}
      />
    </li>
  );
}
