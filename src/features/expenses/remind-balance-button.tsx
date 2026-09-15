"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { remindExpenseBalance, type RemindBalanceState } from "./actions";

type RemindBalanceButtonProps = {
  tripId: string;
  debtorUserId: string;
  currency: string;
};

const initialState: RemindBalanceState = {};

export function RemindBalanceButton({ tripId, debtorUserId, currency }: RemindBalanceButtonProps) {
  const t = useTranslations("trip.expenses");
  const [state, formAction, pending] = useActionState(remindExpenseBalance, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="debtorUserId" value={debtorUserId} />
      <input type="hidden" name="currency" value={currency} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? t("remindPending") : t("remindButton")}
      </Button>
    </form>
  );
}
