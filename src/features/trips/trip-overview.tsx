import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatTime } from "@/lib/format";

import type { ItineraryItem, TripTask } from "./types";

type TripOverviewProps = {
  completedTaskCount: number;
  itineraryItems: ItineraryItem[];
  readiness: number;
  tasks: TripTask[];
  today: string;
  tripId: string;
};

export function TripOverview({
  completedTaskCount,
  itineraryItems,
  readiness,
  tasks,
  today,
  tripId,
}: TripOverviewProps) {
  const nextItems = itineraryItems
    .filter((item) => item.item_date >= today)
    .slice(0, 3);
  const attentionTasks = tasks
    .filter((task) => !task.completed_at && (task.is_critical || (task.due_date && task.due_date < today)))
    .slice(0, 4);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-primary/20 bg-accent p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-accent-foreground">
              <SparklesIcon className="size-4" />
              Travel readiness
            </p>
            <p className="mt-1 text-4xl font-semibold tabular-nums text-accent-foreground">
              {readiness}%
            </p>
          </div>
          <p className="text-right text-sm text-accent-foreground">
            {completedTaskCount} of {tasks.length}
            <br />
            completed
          </p>
        </div>
        <Progress
          aria-label={`${readiness}% ready`}
          className="mt-4 h-2.5 bg-background"
          value={readiness}
        />
        <Button asChild size="sm" variant="ghost" className="mt-4 -ml-2.5">
          <Link href={`/trips/${tripId}?tab=tasks`}>
            View all tasks
            <ArrowRightIcon />
          </Link>
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <AlertTriangleIcon className="size-4.5 text-warning" />
          Needs attention
        </h3>
        {attentionTasks.length ? (
          <ul className="mt-4 space-y-3">
            {attentionTasks.map((task) => {
              const overdue = task.due_date && task.due_date < today;

              return (
                <li key={task.id} className="flex items-start gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {task.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {task.is_critical ? (
                        <Badge className="bg-warning-muted text-warning">
                          Critical
                        </Badge>
                      ) : null}
                      {overdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : null}
                      {task.due_date ? `Due ${formatDate(task.due_date, "medium")}` : "No deadline"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing critical or overdue. Preparation is on track.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <CalendarDaysIcon className="size-4.5 text-muted-foreground" />
            Coming up
          </h3>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/trips/${tripId}?tab=itinerary`}>
              Full itinerary
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        {nextItems.length ? (
          <ol className="mt-4 space-y-3">
            {nextItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  {item.location ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.location}
                    </p>
                  ) : null}
                </div>
                <p className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  {formatDate(item.item_date, "medium")}
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3.5" />
                    {formatTime(item.start_time)}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No upcoming itinerary items scheduled.
          </p>
        )}
      </section>
    </div>
  );
}
