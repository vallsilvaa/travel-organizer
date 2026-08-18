"use client";

import { useActionState } from "react";

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
      <label className="text-sm font-medium text-slate-800 sm:col-span-2">
        Task
        <input
          required
          maxLength={200}
          name="title"
          defaultValue={task?.title}
          placeholder="Book airport transfer"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.title ? <span className="mt-1 block text-red-700">{state.errors.title}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Owner <span className="font-normal text-slate-500">(optional)</span>
        <select
          name="ownerId"
          defaultValue={task?.owner_id ?? ""}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        >
          <option value="">Unassigned</option>
          {participants.map((participant) => (
            <option key={participant.user_id} value={participant.user_id}>
              {participant.display_name} ({participant.role})
            </option>
          ))}
        </select>
        {state.errors?.owner ? <span className="mt-1 block text-red-700">{state.errors.owner}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Category
        <select
          name="category"
          defaultValue={task?.category ?? "other"}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        >
          {taskCategories.map((category) => (
            <option key={category} value={category}>{taskCategoryLabels[category]}</option>
          ))}
        </select>
        {state.errors?.category ? <span className="mt-1 block text-red-700">{state.errors.category}</span> : null}
      </label>
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800">
        <input name="isCritical" type="checkbox" defaultChecked={task?.is_critical} className="size-4 accent-sky-700" />
        Critical before departure
      </label>
      <label className="text-sm font-medium text-slate-800">
        Reference label <span className="font-normal text-slate-500">(optional)</span>
        <input
          maxLength={100}
          name="referenceLabel"
          defaultValue={task?.reference_label ?? ""}
          placeholder="Insurance policy"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.referenceLabel ? <span className="mt-1 block text-red-700">{state.errors.referenceLabel}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Secure reference URL <span className="font-normal text-slate-500">(optional)</span>
        <input
          maxLength={500}
          name="referenceUrl"
          type="url"
          pattern="https://.*"
          defaultValue={task?.reference_url ?? ""}
          placeholder="https://..."
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.referenceUrl ? <span className="mt-1 block text-red-700">{state.errors.referenceUrl}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Due date <span className="font-normal text-slate-500">(optional)</span>
        <input
          name="dueDate"
          type="date"
          defaultValue={task?.due_date ?? ""}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.dueDate ? <span className="mt-1 block text-red-700">{state.errors.dueDate}</span> : null}
      </label>
      {state.message ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{state.message}</p> : null}
      {state.success ? (
        <p className="text-sm text-emerald-700 sm:col-span-2">
          {task ? "Task updated." : "Task added."}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Saving..." : task ? "Save changes" : "Add task"}
      </button>
    </form>
  );
}
