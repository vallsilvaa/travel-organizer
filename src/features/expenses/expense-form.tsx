"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
  getExpenseCategoryLabels,
} from "./validation";

type Participant = { user_id: string; display_name: string; role: string };
type ExpenseShare = { user_id: string; share_amount: string };

type ExpenseFormProps = {
  expense?: {
    id: string;
    description: string;
    amount: string | null;
    currency: string;
    category: string;
    expense_date: string;
    payer_id: string | null;
    payment_status: "paid" | "to_pay";
    estimated_amount: string | null;
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
  const t = useTranslations("expenseForm");
  const tCommon = useTranslations("common");
  const tCategories = useTranslations("categories.expense");
  const expenseCategoryLabels = getExpenseCategoryLabels(tCategories);
  const [state, formAction, pending] = useActionState(
    expense ? updateExpense : createExpense,
    initialState,
  );

  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "to_pay">(expense?.payment_status ?? "paid");
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
      toast.success(expense ? t("toastUpdated") : t("toastAdded"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, expense, t]);

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
        <Label htmlFor="description">{t("descriptionLabel")}</Label>
        <Input
          required
          maxLength={200}
          id="description"
          name="description"
          defaultValue={expense?.description}
          placeholder={t("descriptionPlaceholder")}
        />
        {state.errors?.description ? <p className="text-sm text-destructive">{state.errors.description}</p> : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>{t("paymentStatusLabel")}</Label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="paymentStatus"
              value="paid"
              checked={paymentStatus === "paid"}
              onChange={() => setPaymentStatus("paid")}
            />
            {t("paymentStatusPaid")}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="paymentStatus"
              value="to_pay"
              checked={paymentStatus === "to_pay"}
              onChange={() => setPaymentStatus("to_pay")}
            />
            {t("paymentStatusToPay")}
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="estimatedAmount">
          {t("estimatedAmountLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input
          min="0.01"
          max="999999999999.99"
          step="0.01"
          id="estimatedAmount"
          name="estimatedAmount"
          type="number"
          inputMode="decimal"
          defaultValue={expense?.estimated_amount ?? ""}
        />
        {state.errors?.estimatedAmount ? <p className="text-sm text-destructive">{state.errors.estimatedAmount}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">
          {t("amountLabel")} {paymentStatus === "to_pay" ? <span className="font-normal text-muted-foreground">{tCommon("optional")}</span> : null}
        </Label>
        <Input
          required={paymentStatus === "paid"}
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
        <Label htmlFor="currency">{t("currencyLabel")}</Label>
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
        <Label htmlFor="category">{t("categoryLabel")}</Label>
        <Select required name="category" defaultValue={expense?.category ?? "other"} items={expenseCategoryLabels}>
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
        <Label htmlFor="date">{t("dateLabel")}</Label>
        <Input required id="date" name="date" type="date" defaultValue={expense?.expense_date} />
        {state.errors?.date ? <p className="text-sm text-destructive">{state.errors.date}</p> : null}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="payerId">
          {t("payerLabel")} {paymentStatus === "to_pay" ? <span className="font-normal text-muted-foreground">{tCommon("optional")}</span> : null}
        </Label>
        <Select
          required={paymentStatus === "paid"}
          name="payerId"
          defaultValue={expense?.payer_id ?? undefined}
          items={Object.fromEntries(
            participants.map((participant) => [participant.user_id, `${participant.display_name} (${participant.role})`]),
          )}
        >
          <SelectTrigger id="payerId" className="w-full">
            <SelectValue placeholder={t("payerPlaceholder")} />
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

      {paymentStatus === "paid" ? (
      <div className="space-y-3 rounded-2xl border border-slate-200 p-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={splitEnabled}
            onChange={(event) => setSplitEnabled(event.target.checked)}
          />
          {t("splitToggleLabel")}
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
                {t("splitEqual")}
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === "custom"}
                  onChange={() => setSplitMode("custom")}
                />
                {t("splitCustom")}
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
              {t("splitProgress", {
                current: (splitTotalCents / 100).toFixed(2),
                total: (amountCents / 100).toFixed(2),
              })}
            </p>
            {state.errors?.split ? <p className="text-sm text-destructive">{state.errors.split}</p> : null}
          </div>
        ) : null}
      </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending || (paymentStatus === "paid" && !splitMatches)}
        size="lg"
        className="sm:col-span-2 sm:justify-self-start"
      >
        {pending ? t("savePending") : expense ? t("save") : t("add")}
      </Button>
    </form>
  );
}
