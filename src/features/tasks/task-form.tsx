"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createTask, updateTask, type TaskActionState } from "./actions";
import { taskCategories, taskCategoryLabels, type TaskCategory } from "./templates";

type Participant = { user_id: string; display_name: string; role: string };

type TaskFormProps = {
  participants: Participant[];
  task?: {
    id: string;
    title: string;
    owner_id: string | null;
    due_date: string | null;
    category: TaskCategory;
    is_critical: boolean;
    reference_label: string | null;
    reference_url: string | null;
  };
  tripId: string;
};

const initialState: TaskActionState = {};

export function TaskForm({ participants, task, tripId }: TaskFormProps) {
  const [state, formAction, pending] = useActionState(
    task ? updateTask : createTask,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {task ? <input type="hidden" name="taskId" value={task.id} /> : null}
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Task</Label>
        <Input
          required
          maxLength={200}
          id="title"
          name="title"
          defaultValue={task?.title}
          placeholder="Book airport transfer"
        />
        {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerId">
          Owner <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <select
          id="ownerId"
          name="ownerId"
          defaultValue={task?.owner_id ?? ""}
          className="border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="">Unassigned</option>
          {participants.map((participant) => (
            <option key={participant.user_id} value={participant.user_id}>
              {participant.display_name} ({participant.role})
            </option>
          ))}
        </select>
        {state.errors?.owner ? <p className="text-sm text-destructive">{state.errors.owner}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          defaultValue={task?.category ?? "other"}
          className="border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          {taskCategories.map((category) => (
            <option key={category} value={category}>{taskCategoryLabels[category]}</option>
          ))}
        </select>
        {state.errors?.category ? <p className="text-sm text-destructive">{state.errors.category}</p> : null}
      </div>
      <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium">
        <input name="isCritical" type="checkbox" defaultChecked={task?.is_critical} className="size-4 accent-primary" />
        Critical before departure
      </label>
      <div className="space-y-2">
        <Label htmlFor="referenceLabel">
          Reference label <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          maxLength={100}
          id="referenceLabel"
          name="referenceLabel"
          defaultValue={task?.reference_label ?? ""}
          placeholder="Insurance policy"
        />
        {state.errors?.referenceLabel ? <p className="text-sm text-destructive">{state.errors.referenceLabel}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="referenceUrl">
          Secure reference URL <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          maxLength={500}
          id="referenceUrl"
          name="referenceUrl"
          type="url"
          pattern="https://.*"
          defaultValue={task?.reference_url ?? ""}
          placeholder="https://..."
        />
        {state.errors?.referenceUrl ? <p className="text-sm text-destructive">{state.errors.referenceUrl}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="dueDate">
          Due date <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="dueDate" name="dueDate" type="date" defaultValue={task?.due_date ?? ""} />
        {state.errors?.dueDate ? <p className="text-sm text-destructive">{state.errors.dueDate}</p> : null}
      </div>
      {state.message ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.message}</p> : null}
      {state.success ? (
        <p className="text-sm text-emerald-700 sm:col-span-2">
          {task ? "Task updated." : "Task added."}
        </p>
      ) : null}
      <Button disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? "Saving..." : task ? "Save changes" : "Add task"}
      </Button>
    </form>
  );
}
