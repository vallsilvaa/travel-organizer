"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import {
  computeEqualShares,
  expenseCategories,
  expenseCategoryLabels,
} from "./validation";

type Participant = { user_id: string; display_name: string; role: string };
type ExpenseShare = { user_id: string; share_amount: string };

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
  existingShares?: ExpenseShare[];
  participants: Participant[];
  tripId: string;
};

const initialState: ExpenseActionState = {};

function centsOf(value: string) {
  const cents = Math.round(Number(value || "0") * 100);
  return Number.isFinite(cents) ? cents : 0;
}

export function ExpenseForm({
  expense,
  existingShares = [],
  participants,
  tripId,
}: ExpenseFormProps) {
  const [state, formAction, pending] = useActionState(
    expense ? updateExpense : createExpense,
    initialState,
  );

  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [splitEnabled, setSplitEnabled] = useState(existingShares.length > 0);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(
      existingShares.length
        ? existingShares.map((share) => share.user_id)
        : participants.map((participant) => participant.user_id),
    ),
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    Object.fromEntries(existingShares.map((share) => [share.user_id, share.share_amount])),
  );

  useEffect(() => {
    if (state.success) {
      toast.success(expense ? "Despesa atualizada." : "Despesa adicionada.");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, expense]);

  const selectedIds = useMemo(
    () => participants.map((p) => p.user_id).filter((id) => selected.has(id)),
    [participants, selected],
  );

  const equalShares = useMemo(
    () => computeEqualShares(amount || "0", selectedIds),
    [amount, selectedIds],
  );

  const shareAmounts = splitMode === "equal" ? equalShares : customAmounts;

  const splitTotalCents = selectedIds.reduce(
    (sum, id) => sum + centsOf(shareAmounts[id] ?? ""),
    0,
  );
  const amountCents = centsOf(amount);
  const splitMatches = !splitEnabled || (selectedIds.length > 0 && splitTotalCents === amountCents);

  function toggleParticipant(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {expense ? <input type="hidden" name="expenseId" value={expense.id} /> : null}
      <input
        type="hidden"
        name="participantIds"
        value={participants.map((p) => p.user_id).join(",")}
      />
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
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
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

      <div className="space-y-3 rounded-2xl border border-slate-200 p-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={splitEnabled}
            onChange={(event) => setSplitEnabled(event.target.checked)}
          />
          Dividir despesa entre participantes
        </label>

        {splitEnabled ? (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === "equal"}
                  onChange={() => setSplitMode("equal")}
                />
                Igualmente
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === "custom"}
                  onChange={() => setSplitMode("custom")}
                />
                Personalizado
              </label>
            </div>

            <ul className="space-y-2">
              {participants.map((participant) => {
                const isSelected = selected.has(participant.user_id);
                const value = shareAmounts[participant.user_id] ?? "";
                return (
                  <li
                    key={participant.user_id}
                    className="flex items-center gap-3"
                  >
                    <label className="flex flex-1 items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleParticipant(participant.user_id)}
                      />
                      {participant.display_name}
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!isSelected || splitMode === "equal"}
                      value={isSelected ? value : ""}
                      onChange={(event) =>
                        setCustomAmounts((current) => ({
                          ...current,
                          [participant.user_id]: event.target.value,
                        }))
                      }
                      className="w-28"
                    />
                    {isSelected ? (
                      <input
                        type="hidden"
                        name={`share_${participant.user_id}`}
                        value={value}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <p className={`text-sm ${splitMatches ? "text-slate-600" : "text-destructive"}`}>
              Dividido: {(splitTotalCents / 100).toFixed(2)} / {(amountCents / 100).toFixed(2)}
            </p>
            {state.errors?.split ? <p className="text-sm text-destructive">{state.errors.split}</p> : null}
          </div>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending || !splitMatches}
        size="lg"
        className="sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Salvando..." : expense ? "Salvar alterações" : "Adicionar despesa"}
      </Button>
    </form>
  );
}
