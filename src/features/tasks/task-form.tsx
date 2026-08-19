"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

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

  useEffect(() => {
    if (state.success) {
      toast.success(task ? "Task updated." : "Task added.");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, task]);

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
        <Select name="ownerId" defaultValue={task?.owner_id ?? ""}>
          <SelectTrigger id="ownerId" className="w-full">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Unassigned</SelectItem>
            {participants.map((participant) => (
              <SelectItem key={participant.user_id} value={participant.user_id}>
                {participant.display_name} ({participant.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.owner ? <p className="text-sm text-destructive">{state.errors.owner}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select name="category" defaultValue={task?.category ?? "other"}>
          <SelectTrigger id="category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {taskCategories.map((category) => (
              <SelectItem key={category} value={category}>{taskCategoryLabels[category]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <Button disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? "Saving..." : task ? "Save changes" : "Add task"}
      </Button>
    </form>
  );
}
