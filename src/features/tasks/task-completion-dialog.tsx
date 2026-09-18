"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getReservationTypeLabels, reservationTypes, type ReservationType } from "@/features/reservations/validation";
import type { TaskCategory } from "./templates";

import { convertPrepTaskOnCompletion, setTaskCompletion, type ConvertPrepTaskActionState } from "./actions";

type Participant = { user_id: string; display_name: string };

// Only used as a starting point in the dialog - the Select stays fully
// editable, since not every category maps to an obvious reservation type.
const categoryToReservationType: Partial<Record<TaskCategory, ReservationType>> = {
  lodging: "lodging",
  transport: "transport",
  experiences: "tickets",
};

type TaskCompletionDialogProps = {
  tripId: string;
  taskId: string;
  completed: boolean;
  title: string;
  category: TaskCategory;
  city: string | null;
  currency: string | null;
  estimatedAmount: string | null;
  paidAmount: string | null;
  participants: Participant[];
  completeLabel: string;
  completingLabel: string;
  reopenLabel: string;
  reopeningLabel: string;
};

const initialState: ConvertPrepTaskActionState = {};

export function TaskCompletionDialog({
  tripId,
  taskId,
  completed,
  title,
  category,
  city,
  currency,
  estimatedAmount,
  paidAmount,
  participants,
  completeLabel,
  completingLabel,
  reopenLabel,
  reopeningLabel,
}: TaskCompletionDialogProps) {
  const t = useTranslations("taskConversionDialog");
  const tReservationType = useTranslations("categories.reservationType");
  const reservationTypeLabels = getReservationTypeLabels(tReservationType);
  const [isTogglePending, startToggleTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [addReservation, setAddReservation] = useState(false);
  const [addItinerary, setAddItinerary] = useState(false);
  const [reservationPaymentStatus, setReservationPaymentStatus] = useState<"paid" | "to_pay">(
    paidAmount ? "paid" : "to_pay",
  );
  const [reservationAmount, setReservationAmount] = useState(paidAmount ?? estimatedAmount ?? "");
  const [responsibleIds, setResponsibleIds] = useState<Set<string>>(new Set());

  const perPersonShare = useMemo(() => {
    const total = Number(reservationAmount);
    if (!Number.isFinite(total) || total <= 0 || responsibleIds.size === 0) {
      return null;
    }
    return total / responsibleIds.size;
  }, [reservationAmount, responsibleIds]);

  function toggleResponsible(userId: string) {
    setResponsibleIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  const [state, formAction, pending] = useActionState(convertPrepTaskOnCompletion, initialState);

  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (state.success) {
      toast.success(t("toastSaved"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t]);

  function handleToggle() {
    if (!completed) {
      // Only opens the dialog here - the task itself is marked complete by
      // convertPrepTaskOnCompletion once the visitor finishes with it
      // (Salvar or Pular), not the instant it's clicked. Completing (and
      // revalidating) immediately used to remove this task's row from the
      // default "open tasks" view before there was time to interact with
      // the dialog's checkboxes.
      setOpen(true);
      return;
    }
    startToggleTransition(async () => {
      const formData = new FormData();
      formData.set("tripId", tripId);
      formData.set("taskId", taskId);
      formData.set("completed", "false");
      await setTaskCompletion(formData);
    });
  }

  function handleSkip() {
    setOpen(false);
    startToggleTransition(async () => {
      const formData = new FormData();
      formData.set("tripId", tripId);
      formData.set("taskId", taskId);
      formData.set("completed", "true");
      await setTaskCompletion(formData);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={isTogglePending} onClick={handleToggle}>
        {isTogglePending ? (completed ? reopeningLabel : completingLabel) : completed ? reopenLabel : completeLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          // Dismissing via the backdrop/Escape/close button is the same as
          // clicking "Pular" - the task still needs to end up marked
          // complete, since opening this dialog is now the only signal
          // that it was.
          if (!nextOpen) {
            handleSkip();
          } else {
            setOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description", { title })}</DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-5">
            <input type="hidden" name="tripId" value={tripId} />
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="addReservation" value={addReservation ? "true" : "false"} />
            <input type="hidden" name="addItinerary" value={addItinerary ? "true" : "false"} />
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="location" value={city ?? ""} />

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={addReservation}
                onChange={(event) => setAddReservation(event.target.checked)}
              />
              {t("addReservation")}
            </label>

            {addReservation ? (
              <div className="space-y-3 rounded-2xl border p-4">
                <div className="space-y-2">
                  <Label htmlFor="conversion-reservationType">{t("reservationTypeLabel")}</Label>
                  <Select
                    name="reservationType"
                    defaultValue={categoryToReservationType[category] ?? "tickets"}
                    items={reservationTypeLabels}
                  >
                    <SelectTrigger id="conversion-reservationType" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reservationTypes.map((type) => (
                        <SelectItem key={type} value={type}>{reservationTypeLabels[type]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {state.reservationErrors?.reservationType ? (
                    <p className="text-sm text-destructive">{state.reservationErrors.reservationType}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="conversion-startDate">{t("startDateLabel")}</Label>
                    <Input required id="conversion-startDate" name="startDate" type="date" />
                    {state.reservationErrors?.startDate ? (
                      <p className="text-sm text-destructive">{state.reservationErrors.startDate}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conversion-startTime">{t("startTimeLabel")}</Label>
                    <Input id="conversion-startTime" name="startTime" type="time" step="60" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="conversion-paidAmount">{t("amountLabel")}</Label>
                    <Input
                      required
                      min="0"
                      step="0.01"
                      type="number"
                      inputMode="decimal"
                      id="conversion-paidAmount"
                      name="paidAmount"
                      value={reservationAmount}
                      onChange={(event) => setReservationAmount(event.target.value)}
                    />
                    {state.reservationErrors?.paidAmount ? (
                      <p className="text-sm text-destructive">{state.reservationErrors.paidAmount}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conversion-currency">{t("currencyLabel")}</Label>
                    <Input
                      required
                      minLength={3}
                      maxLength={3}
                      id="conversion-currency"
                      name="currency"
                      defaultValue={currency ?? ""}
                      placeholder="BRL"
                      className="uppercase"
                    />
                    {state.reservationErrors?.currency ? (
                      <p className="text-sm text-destructive">{state.reservationErrors.currency}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("paymentStatusLabel")}</Label>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="paid"
                        checked={reservationPaymentStatus === "paid"}
                        onChange={() => setReservationPaymentStatus("paid")}
                      />
                      {t("paymentStatusPaid")}
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="to_pay"
                        checked={reservationPaymentStatus === "to_pay"}
                        onChange={() => setReservationPaymentStatus("to_pay")}
                      />
                      {t("paymentStatusToPay")}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("responsibleLabel")}</Label>
                  <ul className="space-y-1">
                    {participants.map((participant) => (
                      <li key={participant.user_id}>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="responsibleIds"
                            value={participant.user_id}
                            checked={responsibleIds.has(participant.user_id)}
                            onChange={() => toggleResponsible(participant.user_id)}
                          />
                          {participant.display_name}
                        </label>
                      </li>
                    ))}
                  </ul>
                  {perPersonShare !== null && responsibleIds.size > 1 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("responsibleSplitPreview", { amount: perPersonShare.toFixed(2), count: responsibleIds.size })}
                    </p>
                  ) : null}
                  {state.reservationErrors?.responsibleIds ? (
                    <p className="text-sm text-destructive">{state.reservationErrors.responsibleIds}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={addItinerary}
                onChange={(event) => setAddItinerary(event.target.checked)}
              />
              {t("addItinerary")}
            </label>

            {addItinerary ? (
              <div className="space-y-2 rounded-2xl border p-4">
                <Label htmlFor="conversion-itineraryDate">{t("itineraryDateLabel")}</Label>
                <Input required id="conversion-itineraryDate" name="date" type="date" />
                {state.itineraryErrors?.date ? (
                  <p className="text-sm text-destructive">{state.itineraryErrors.date}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" disabled={isTogglePending} onClick={handleSkip}>
                {t("skip")}
              </Button>
              <Button type="submit" disabled={pending || (!addReservation && !addItinerary)}>
                {pending ? t("savePending") : t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
