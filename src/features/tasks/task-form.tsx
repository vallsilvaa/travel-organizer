"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

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

const selectClass = "w-full [&>select]:h-11";

export function TaskForm({ participants, task, tripId }: TaskFormProps) {
  const [state, formAction, pending] = useActionState(
    task ? updateTask : createTask,
    initialState,
  );
  const fieldId = (name: string) => `task-${task?.id ?? "new"}-${name}`;

  return (
    <form action={formAction}>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="tripId" value={tripId} />
        {task ? <input type="hidden" name="taskId" value={task.id} /> : null}

        <Field className="sm:col-span-2" data-invalid={Boolean(state.errors?.title)}>
          <FieldLabel htmlFor={fieldId("title")}>Task</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.title)}
            className="h-11"
            defaultValue={task?.title}
            id={fieldId("title")}
            maxLength={200}
            name="title"
            placeholder="Book airport transfer"
          />
          <FieldError>{state.errors?.title}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.owner)}>
          <FieldLabel htmlFor={fieldId("owner")}>Owner</FieldLabel>
          <NativeSelect
            className={selectClass}
            defaultValue={task?.owner_id ?? ""}
            id={fieldId("owner")}
            name="ownerId"
          >
            <NativeSelectOption value="">Unassigned</NativeSelectOption>
            {participants.map((participant) => (
              <NativeSelectOption
                key={participant.user_id}
                value={participant.user_id}
              >
                {participant.display_name} ({participant.role})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>Optional.</FieldDescription>
          <FieldError>{state.errors?.owner}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.category)}>
          <FieldLabel htmlFor={fieldId("category")}>Category</FieldLabel>
          <NativeSelect
            className={selectClass}
            defaultValue={task?.category ?? "other"}
            id={fieldId("category")}
            name="category"
          >
            {taskCategories.map((category) => (
              <NativeSelectOption key={category} value={category}>
                {taskCategoryLabels[category]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError>{state.errors?.category}</FieldError>
        </Field>

        <FieldLabel className="rounded-lg border border-border px-4 py-3 has-checked:border-primary/30 has-checked:bg-primary/5">
          <input
            className="size-4 rounded-[4px] accent-primary"
            defaultChecked={task?.is_critical}
            name="isCritical"
            type="checkbox"
          />
          Critical before departure
        </FieldLabel>

        <Field data-invalid={Boolean(state.errors?.referenceLabel)}>
          <FieldLabel htmlFor={fieldId("referenceLabel")}>
            Reference label
          </FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.referenceLabel)}
            className="h-11"
            defaultValue={task?.reference_label ?? ""}
            id={fieldId("referenceLabel")}
            maxLength={100}
            name="referenceLabel"
            placeholder="Insurance policy"
          />
          <FieldDescription>Optional.</FieldDescription>
          <FieldError>{state.errors?.referenceLabel}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.referenceUrl)}>
          <FieldLabel htmlFor={fieldId("referenceUrl")}>
            Secure reference URL
          </FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.referenceUrl)}
            className="h-11"
            defaultValue={task?.reference_url ?? ""}
            id={fieldId("referenceUrl")}
            maxLength={500}
            name="referenceUrl"
            pattern="https://.*"
            placeholder="https://..."
            type="url"
          />
          <FieldDescription>Optional.</FieldDescription>
          <FieldError>{state.errors?.referenceUrl}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.dueDate)}>
          <FieldLabel htmlFor={fieldId("dueDate")}>Due date</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.dueDate)}
            className="h-11"
            defaultValue={task?.due_date ?? ""}
            id={fieldId("dueDate")}
            name="dueDate"
            type="date"
          />
          <FieldDescription>Optional.</FieldDescription>
          <FieldError>{state.errors?.dueDate}</FieldError>
        </Field>

        {state.message ? (
          <Alert
            variant="destructive"
            className="bg-destructive-muted sm:col-span-2"
          >
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {state.success ? (
          <p className="text-sm text-success sm:col-span-2">
            {task ? "Task updated." : "Task added."}
          </p>
        ) : null}

        <Button
          disabled={pending}
          size="lg"
          className="h-11 px-5 text-base font-semibold sm:col-span-2 sm:justify-self-start"
        >
          {pending ? "Saving..." : task ? "Save changes" : "Add task"}
        </Button>
      </FieldGroup>
    </form>
  );
}
