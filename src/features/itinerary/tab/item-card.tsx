import type { getTranslations } from "next-intl/server";
import Link from "next/link";

import { CommentThread, type ItemComment } from "@/features/comments/comment-thread";
import { deleteItineraryItem } from "@/features/itinerary/actions";
import { ItineraryForm } from "@/features/itinerary/itinerary-form";
import { ItemActionsMenu } from "@/components/item-actions-menu";

type Translator = Awaited<ReturnType<typeof getTranslations<"trip">>>;

export type ItineraryItem = {
  id: string;
  item_date: string;
  start_time: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  period: string | null;
  city: string | null;
  action: string | null;
  template_id: string | null;
};

type LinkedReservation = { id: string; title: string };
type LinkedTask = { id: string; title: string; completed_at: string | null };

type ItineraryItemCardProps = {
  item: ItineraryItem;
  tripId: string;
  isArchived: boolean;
  existingActions: string[];
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
  existingActions,
  whenLabel,
  linkedReservations,
  linkedTasks,
  comments,
  currentUserId,
  participantNames,
  t,
}: ItineraryItemCardProps) {
  return (
    <li id={`itinerary-${item.id}`} className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700">{whenLabel}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            {item.title}
            {item.action ? (
              <span className="ml-2 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 align-middle text-xs font-semibold text-sky-800">
                {item.action}
              </span>
            ) : null}
          </h3>
          {item.location || item.city ? (
            <p className="mt-1 text-sm text-slate-600">
              {[item.location, item.city].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {item.notes ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.notes}</p> : null}
          {linkedReservations.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
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
            <div className="mt-3 flex flex-wrap gap-2">
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
        </div>
        {!isArchived ? (
          <ItemActionsMenu
            editLabel={t("itinerary.editItem")}
            editForm={<ItineraryForm item={item} tripId={tripId} existingActions={existingActions} />}
            deleteAction={deleteItineraryItem}
            deleteHiddenFields={{ tripId, itemId: item.id }}
            deleteTitle={t("itinerary.deleteItemTitle")}
            deleteDescription={t("itinerary.deleteItemDescription", { title: item.title })}
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
