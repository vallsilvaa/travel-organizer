"use client";

import { useActionState } from "react";

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

export function ExpenseForm({ expense, participants, tripId }: ExpenseFormProps) {
  const [state, formAction, pending] = useActionState(
    expense ? updateExpense : createExpense,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {expense ? <input type="hidden" name="expenseId" value={expense.id} /> : null}
      <label className="text-sm font-medium text-slate-800 sm:col-span-2">
        Description
        <input
          required
          maxLength={200}
          name="description"
          defaultValue={expense?.description}
          placeholder="Dinner reservation"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.description ? <span className="mt-1 block text-red-700">{state.errors.description}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Amount
        <input
          required
          min="0.01"
          max="999999999999.99"
          step="0.01"
          name="amount"
          type="number"
          inputMode="decimal"
          defaultValue={expense?.amount}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.amount ? <span className="mt-1 block text-red-700">{state.errors.amount}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Currency
        <input
          required
          minLength={3}
          maxLength={3}
          name="currency"
          defaultValue={expense?.currency ?? "BRL"}
          placeholder="BRL"
          className="mt-2 w-full uppercase rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.currency ? <span className="mt-1 block text-red-700">{state.errors.currency}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Category
        <select
          required
          name="category"
          defaultValue={expense?.category ?? "other"}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        >
          {expenseCategories.map((category) => (
            <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>
          ))}
        </select>
        {state.errors?.category ? <span className="mt-1 block text-red-700">{state.errors.category}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800">
        Date
        <input
          required
          name="date"
          type="date"
          defaultValue={expense?.expense_date}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        {state.errors?.date ? <span className="mt-1 block text-red-700">{state.errors.date}</span> : null}
      </label>
      <label className="text-sm font-medium text-slate-800 sm:col-span-2">
        Payer
        <select
          required
          name="payerId"
          defaultValue={expense?.payer_id ?? ""}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        >
          <option value="" disabled>Choose a participant</option>
          {participants.map((participant) => (
            <option key={participant.user_id} value={participant.user_id}>
              {participant.display_name} ({participant.role})
            </option>
          ))}
        </select>
        {state.errors?.payer ? <span className="mt-1 block text-red-700">{state.errors.payer}</span> : null}
      </label>
      {state.message ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{state.message}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700 sm:col-span-2">{expense ? "Expense updated." : "Expense added."}</p> : null}
      <button
        disabled={pending}
        className="rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Saving..." : expense ? "Save changes" : "Add expense"}
      </button>
    </form>
  );
}
