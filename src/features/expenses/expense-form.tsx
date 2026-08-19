"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createExpense, updateExpense, type ExpenseActionState } from "./actions";
import { expenseCategories } from "./validation";

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

const selectClassName =
  "border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function ExpenseForm({ expense, participants, tripId }: ExpenseFormProps) {
  const [state, formAction, pending] = useActionState(
    expense ? updateExpense : createExpense,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {expense ? <input type="hidden" name="expenseId" value={expense.id} /> : null}
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Input
          required
          maxLength={200}
          id="description"
          name="description"
          defaultValue={expense?.description}
          placeholder="Dinner reservation"
        />
        {state.errors?.description ? <p className="text-sm text-destructive">{state.errors.description}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
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
        <Label htmlFor="currency">Currency</Label>
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
        <Label htmlFor="category">Category</Label>
        <select
          required
          id="category"
          name="category"
          defaultValue={expense?.category ?? "other"}
          className={selectClassName}
        >
          {expenseCategories.map((category) => (
            <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>
          ))}
        </select>
        {state.errors?.category ? <p className="text-sm text-destructive">{state.errors.category}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input required id="date" name="date" type="date" defaultValue={expense?.expense_date} />
        {state.errors?.date ? <p className="text-sm text-destructive">{state.errors.date}</p> : null}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="payerId">Payer</Label>
        <select
          required
          id="payerId"
          name="payerId"
          defaultValue={expense?.payer_id ?? ""}
          className={selectClassName}
        >
          <option value="" disabled>Choose a participant</option>
          {participants.map((participant) => (
            <option key={participant.user_id} value={participant.user_id}>
              {participant.display_name} ({participant.role})
            </option>
          ))}
        </select>
        {state.errors?.payer ? <p className="text-sm text-destructive">{state.errors.payer}</p> : null}
      </div>
      {state.message ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.message}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 sm:col-span-2">{expense ? "Expense updated." : "Expense added."}</p> : null}
      <Button disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? "Saving..." : expense ? "Save changes" : "Add expense"}
      </Button>
    </form>
  );
}
