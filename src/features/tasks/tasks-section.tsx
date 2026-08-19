import {
  ExternalLinkIcon,
  ListChecksIcon,
  SlidersHorizontalIcon,
  SquarePlusIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { CommentThread } from "@/features/comments/comment-thread";
import type { TripSectionProps, TripTask } from "@/features/trips/types";
import { formatDate } from "@/lib/format";

import { addEnglandPreparationChecklist, deleteTask, setTaskCompletion } from "./actions";
import { TaskForm } from "./task-form";
import { taskCategories, taskCategoryLabels, type TaskCategory } from "./templates";

type TasksSectionProps = TripSectionProps & {
  categoryFilter: TaskCategory | "all";
  error: boolean;
  hasAnyTask: boolean;
  ownerFilter: string;
  statusFilter: string;
  tasksByCategory: Array<{ category: TaskCategory; tasks: TripTask[] }>;
  today: string;
};

export function TasksSection({
  categoryFilter,
  commentsFor,
  currentUserId,
  error,
  hasAnyTask,
  ownerFilter,
  participantNames,
  participants,
  statusFilter,
  tasksByCategory,
  today,
  tripId,
}: TasksSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted-foreground">
          Complete documents, bookings, money, health, connectivity, and packing
          before departure.
        </p>
        <form action={addEnglandPreparationChecklist} className="shrink-0">
          <input type="hidden" name="tripId" value={tripId} />
          <Button size="sm" variant="outline">
            <ListChecksIcon />
            Add England checklist
          </Button>
        </form>
      </div>

      <details
        className="rounded-2xl border border-border bg-card p-5"
        open={!hasAnyTask}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-foreground">
          <SquarePlusIcon className="size-4.5 text-primary" />
          Add a custom preparation task
        </summary>
        <div className="mt-5">
          <TaskForm participants={participants} tripId={tripId} />
        </div>
      </details>

      <form className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
          Filters
        </p>
        {/* Keeps the reader on this tab when the filter form submits. */}
        <input type="hidden" name="tab" value="tasks" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="filter-status">Status</FieldLabel>
            <NativeSelect
              className="w-full"
              defaultValue={statusFilter}
              id="filter-status"
              name="status"
            >
              <NativeSelectOption value="all">All statuses</NativeSelectOption>
              <NativeSelectOption value="open">Open</NativeSelectOption>
              <NativeSelectOption value="completed">Completed</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-owner">Owner</FieldLabel>
            <NativeSelect
              className="w-full"
              defaultValue={ownerFilter}
              id="filter-owner"
              name="owner"
            >
              <NativeSelectOption value="all">All owners</NativeSelectOption>
              <NativeSelectOption value="unassigned">
                Unassigned
              </NativeSelectOption>
              {participants.map((participant) => (
                <NativeSelectOption
                  key={participant.user_id}
                  value={participant.user_id}
                >
                  {participant.display_name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-category">Category</FieldLabel>
            <NativeSelect
              className="w-full"
              defaultValue={categoryFilter}
              id="filter-category"
              name="category"
            >
              <NativeSelectOption value="all">All categories</NativeSelectOption>
              {taskCategories.map((category) => (
                <NativeSelectOption key={category} value={category}>
                  {taskCategoryLabels[category]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Button size="sm" variant="outline" className="mt-4">
          Apply filters
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive" className="bg-destructive-muted">
          <AlertDescription>
            We could not load preparation tasks. Try refreshing the page.
          </AlertDescription>
        </Alert>
      ) : tasksByCategory.length ? (
        <div className="space-y-8">
          {tasksByCategory.map((group) => (
            <section key={group.category}>
              <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {taskCategoryLabels[group.category]}
              </h3>
              <ul className="mt-3 space-y-4">
                {group.tasks.map((task) => {
                  const overdue =
                    !task.completed_at && task.due_date && task.due_date < today;
                  const upcoming =
                    !task.completed_at && task.due_date && task.due_date >= today;

                  return (
                    <li
                      key={task.id}
                      className={`rounded-2xl border p-5 ${
                        task.completed_at
                          ? "border-border bg-muted/40"
                          : overdue
                            ? "border-destructive/25 bg-destructive-muted"
                            : upcoming
                              ? "border-primary/25 bg-accent"
                              : "border-border bg-card"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4
                              className={`font-semibold ${
                                task.completed_at
                                  ? "text-muted-foreground line-through"
                                  : "text-foreground"
                              }`}
                            >
                              {task.title}
                            </h4>
                            {task.is_critical && !task.completed_at ? (
                              <Badge className="bg-warning-muted text-warning">
                                Critical
                              </Badge>
                            ) : null}
                            {overdue ? (
                              <Badge variant="destructive">Overdue</Badge>
                            ) : null}
                            {upcoming ? (
                              <Badge className="bg-primary/10 text-primary">
                                Upcoming
                              </Badge>
                            ) : null}
                            {task.completed_at ? (
                              <Badge className="bg-success-muted text-success">
                                Completed
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {participantNames.get(task.owner_id ?? "") ??
                              "Unassigned"}
                            {task.due_date
                              ? ` · Due ${formatDate(task.due_date)}`
                              : " · No deadline"}
                            {task.due_offset_days !== null
                              ? ` · ${task.due_offset_days} days before departure`
                              : ""}
                          </p>
                          {task.reference_url ? (
                            <Button
                              asChild
                              size="sm"
                              variant="link"
                              className="mt-2 h-auto px-0 font-semibold"
                            >
                              <a
                                href={task.reference_url}
                                target="_blank"
                                rel="noreferrer noopener"
                              >
                                {task.reference_label ??
                                  "Open supporting reference"}
                                <ExternalLinkIcon />
                              </a>
                            </Button>
                          ) : null}
                        </div>
                        <form action={setTaskCompletion} className="shrink-0">
                          <input type="hidden" name="tripId" value={tripId} />
                          <input type="hidden" name="taskId" value={task.id} />
                          <input
                            type="hidden"
                            name="completed"
                            value={task.completed_at ? "false" : "true"}
                          />
                          <Button size="sm" variant="outline" className="bg-card">
                            {task.completed_at ? "Reopen" : "Complete"}
                          </Button>
                        </form>
                      </div>

                      <Separator className="mt-4" />
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-semibold text-primary">
                          Edit or remove
                        </summary>
                        <div className="mt-4">
                          <TaskForm
                            participants={participants}
                            task={task}
                            tripId={tripId}
                          />
                        </div>
                        <form action={deleteTask} className="mt-4">
                          <input type="hidden" name="tripId" value={tripId} />
                          <input type="hidden" name="taskId" value={task.id} />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                          >
                            Remove this preparation task
                          </Button>
                        </form>
                      </details>

                      <CommentThread
                        comments={commentsFor("task", task.id)}
                        currentUserId={currentUserId}
                        itemId={task.id}
                        itemType="task"
                        participantNames={participantNames}
                        tripId={tripId}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <Empty className="rounded-2xl border border-dashed border-input">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecksIcon />
            </EmptyMedia>
            <EmptyTitle>No preparation tasks match these filters</EmptyTitle>
            <EmptyDescription>
              Add the England checklist or create a custom task.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
