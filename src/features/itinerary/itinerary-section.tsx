import { CalendarPlusIcon, ClockIcon, MapPinIcon, RouteIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { CommentThread } from "@/features/comments/comment-thread";
import type { ItineraryItem, TripSectionProps } from "@/features/trips/types";
import { formatDate, formatTime } from "@/lib/format";

import { deleteItineraryItem } from "./actions";
import { ItineraryForm } from "./itinerary-form";

type ItinerarySectionProps = TripSectionProps & {
  error: boolean;
  items: ItineraryItem[];
};

export function ItinerarySection({
  commentsFor,
  currentUserId,
  error,
  items,
  participantNames,
  tripId,
}: ItinerarySectionProps) {
  return (
    <div className="space-y-6">
      <details
        className="rounded-2xl border border-border bg-card p-5"
        open={!items.length}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-foreground">
          <CalendarPlusIcon className="size-4.5 text-primary" />
          Add itinerary item
        </summary>
        <div className="mt-5">
          <ItineraryForm tripId={tripId} />
        </div>
      </details>

      {error ? (
        <Alert variant="destructive" className="bg-destructive-muted">
          <AlertDescription>
            We could not load the itinerary. Try refreshing the page.
          </AlertDescription>
        </Alert>
      ) : items.length ? (
        <ol className="space-y-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-primary">
                    <span>{formatDate(item.item_date)}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ClockIcon className="size-3.5" />
                      {formatTime(item.start_time)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  {item.location ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPinIcon className="size-3.5 shrink-0" />
                      {item.location}
                    </p>
                  ) : null}
                  {item.notes ? (
                    <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                      {item.notes}
                    </p>
                  ) : null}
                </div>
                <form action={deleteItineraryItem}>
                  <input type="hidden" name="tripId" value={tripId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </Button>
                </form>
              </div>

              <Separator className="mt-4" />
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  Edit item
                </summary>
                <div className="mt-4">
                  <ItineraryForm item={item} tripId={tripId} />
                </div>
              </details>

              <CommentThread
                comments={commentsFor("itinerary", item.id)}
                currentUserId={currentUserId}
                itemId={item.id}
                itemType="itinerary"
                participantNames={participantNames}
                tripId={tripId}
              />
            </li>
          ))}
        </ol>
      ) : (
        <Empty className="rounded-2xl border border-dashed border-input">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RouteIcon />
            </EmptyMedia>
            <EmptyTitle>No itinerary items yet</EmptyTitle>
            <EmptyDescription>
              Add the first activity, reservation, or meeting point above.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
