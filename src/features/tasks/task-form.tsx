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
      toast.success(task ? "Tarefa atualizada." : "Tarefa adicionada.");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, task]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {task ? <input type="hidden" name="taskId" value={task.id} /> : null}
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Tarefa</Label>
        <Input
          required
          maxLength={200}
          id="title"
          name="title"
          defaultValue={task?.title}
          placeholder="Reservar transporte do aeroporto"
        />
        {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerId">
          Responsável <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Select name="ownerId" defaultValue={task?.owner_id ?? ""}>
          <SelectTrigger id="ownerId" className="w-full">
            <SelectValue placeholder="Sem responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Sem responsável</SelectItem>
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
        <Label htmlFor="category">Categoria</Label>
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
        Crítica antes da partida
      </label>
      <div className="space-y-2">
        <Label htmlFor="referenceLabel">
          Rótulo de referência <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          maxLength={100}
          id="referenceLabel"
          name="referenceLabel"
          defaultValue={task?.reference_label ?? ""}
          placeholder="Apólice de seguro"
        />
        {state.errors?.referenceLabel ? <p className="text-sm text-destructive">{state.errors.referenceLabel}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="referenceUrl">
          URL segura de referência <span className="font-normal text-muted-foreground">(opcional)</span>
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
          Data limite <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="dueDate" name="dueDate" type="date" defaultValue={task?.due_date ?? ""} />
        {state.errors?.dueDate ? <p className="text-sm text-destructive">{state.errors.dueDate}</p> : null}
      </div>
      <Button type="submit" disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? "Salvando..." : task ? "Salvar alterações" : "Adicionar tarefa"}
      </Button>
    </form>
  );
}
