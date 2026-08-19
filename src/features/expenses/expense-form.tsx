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

import { createExpense, updateExpense, type ExpenseActionState } from "./actions";
import { expenseCategories, expenseCategoryLabels } from "./validation";

type Participant = { user_id: string; display_name: string; role: string };

type ExpenseFormProps = {
  expense?: {
    id: string;
    description: string;
    amount: string;
    currency: string;
    category: string;
    expense_date: string;
    payer_id: string;
  };
  participants: Participant[];
  tripId: string;
};

const initialState: ExpenseActionState = {};

export function ExpenseForm({ expense, participants, tripId }: ExpenseFormProps) {
  const [state, formAction, pending] = useActionState(
    expense ? updateExpense : createExpense,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      toast.success(expense ? "Despesa atualizada." : "Despesa adicionada.");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, expense]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {expense ? <input type="hidden" name="expenseId" value={expense.id} /> : null}
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="description">Descrição</Label>
        <Input
          required
          maxLength={200}
          id="description"
          name="description"
          defaultValue={expense?.description}
          placeholder="Reserva de jantar"
        />
        {state.errors?.description ? <p className="text-sm text-destructive">{state.errors.description}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Valor</Label>
        <Input
          required
          min="0.01"
          max="999999999999.99"
          step="0.01"
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          defaultValue={expense?.amount}
        />
        {state.errors?.amount ? <p className="text-sm text-destructive">{state.errors.amount}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="currency">Moeda</Label>
        <Input
          required
          minLength={3}
          maxLength={3}
          id="currency"
          name="currency"
          defaultValue={expense?.currency ?? "BRL"}
          placeholder="BRL"
          className="uppercase"
        />
        {state.errors?.currency ? <p className="text-sm text-destructive">{state.errors.currency}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Categoria</Label>
        <Select required name="category" defaultValue={expense?.category ?? "other"}>
          <SelectTrigger id="category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {expenseCategories.map((category) => (
              <SelectItem key={category} value={category}>{expenseCategoryLabels[category]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.category ? <p className="text-sm text-destructive">{state.errors.category}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="date">Data</Label>
        <Input required id="date" name="date" type="date" defaultValue={expense?.expense_date} />
        {state.errors?.date ? <p className="text-sm text-destructive">{state.errors.date}</p> : null}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="payerId">Pagador</Label>
        <Select required name="payerId" defaultValue={expense?.payer_id}>
          <SelectTrigger id="payerId" className="w-full">
            <SelectValue placeholder="Escolha um participante" />
          </SelectTrigger>
          <SelectContent>
            {participants.map((participant) => (
              <SelectItem key={participant.user_id} value={participant.user_id}>
                {participant.display_name} ({participant.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.payer ? <p className="text-sm text-destructive">{state.errors.payer}</p> : null}
      </div>
      <Button type="submit" disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? "Salvando..." : expense ? "Salvar alterações" : "Adicionar despesa"}
      </Button>
    </form>
  );
}
