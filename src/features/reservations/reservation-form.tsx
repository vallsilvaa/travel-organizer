"use client";

import { useActionState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { Textarea } from "@/components/ui/textarea";

import { localeTag, type Locale } from "@/i18n/locale";
import {
  createReservation,
  updateReservation,
  type ReservationActionState,
} from "./actions";
import { getReservationTypeLabels, reservationTypes } from "./validation";

type ReservationFormProps = {
  reservation?: {
    id: string;
    reservation_type: string;
    title: string;
    provider: string | null;
    confirmation_code: string | null;
    start_date: string;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
    location: string | null;
    destination_location: string | null;
    notes: string | null;
    itinerary_item_id: string | null;
    paid_amount: string | null;
    currency: string | null;
    payer_id: string | null;
  };
  itineraryItems?: { id: string; title: string; item_date: string }[];
  participants?: { user_id: string; display_name: string }[];
  tripId: string;
};

const initialState: ReservationActionState = {};

function formatItemDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function ReservationForm({ reservation, itineraryItems = [], participants = [], tripId }: ReservationFormProps) {
  const t = useTranslations("reservationForm");
  const tCommon = useTranslations("common");
  const tReservationTypes = useTranslations("categories.reservationType");
  const reservationTypeLabels = getReservationTypeLabels(tReservationTypes);
  const locale = useLocale() as Locale;
  const action = reservation ? updateReservation : createReservation;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(reservation ? t("toastUpdated") : t("toastAdded"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, reservation, t]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {reservation ? <input type="hidden" name="reservationId" value={reservation.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="reservation-type">{t("typeLabel")}</Label>
        <Select required name="reservationType" defaultValue={reservation?.reservation_type ?? "flight"} items={reservationTypeLabels}>
          <SelectTrigger id="reservation-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reservationTypes.map((type) => (
              <SelectItem key={type} value={type}>{reservationTypeLabels[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.reservationType ? <p className="text-sm text-destructive">{state.errors.reservationType}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-title">{t("titleLabel")}</Label>
        <Input
          required
          maxLength={200}
          id="reservation-title"
          name="title"
          defaultValue={reservation?.title}
          placeholder={t("titlePlaceholder")}
        />
        {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-provider">
          {t("providerLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input
          maxLength={200}
          id="reservation-provider"
          name="provider"
          defaultValue={reservation?.provider ?? ""}
          placeholder={t("providerPlaceholder")}
        />
        {state.errors?.provider ? <p className="text-sm text-destructive">{state.errors.provider}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-confirmationCode">
          {t("confirmationCodeLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input
          maxLength={100}
          id="reservation-confirmationCode"
          name="confirmationCode"
          defaultValue={reservation?.confirmation_code ?? ""}
          placeholder={t("confirmationCodePlaceholder")}
          autoComplete="off"
        />
        {state.errors?.confirmationCode ? <p className="text-sm text-destructive">{state.errors.confirmationCode}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-startDate">{t("startDateLabel")}</Label>
        <Input required id="reservation-startDate" name="startDate" type="date" defaultValue={reservation?.start_date} />
        {state.errors?.startDate ? <p className="text-sm text-destructive">{state.errors.startDate}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-startTime">
          {t("startTimeLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input id="reservation-startTime" name="startTime" type="time" defaultValue={reservation?.start_time?.slice(0, 5)} />
        {state.errors?.startTime ? <p className="text-sm text-destructive">{state.errors.startTime}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-endDate">
          {t("endDateLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input id="reservation-endDate" name="endDate" type="date" defaultValue={reservation?.end_date ?? ""} />
        {state.errors?.endDate ? <p className="text-sm text-destructive">{state.errors.endDate}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-endTime">
          {t("endTimeLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input id="reservation-endTime" name="endTime" type="time" defaultValue={reservation?.end_time?.slice(0, 5) ?? ""} />
        {state.errors?.endTime ? <p className="text-sm text-destructive">{state.errors.endTime}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-location">
          {t("locationLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input
          maxLength={200}
          id="reservation-location"
          name="location"
          defaultValue={reservation?.location ?? ""}
          placeholder={t("locationPlaceholder")}
        />
        {state.errors?.location ? <p className="text-sm text-destructive">{state.errors.location}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-destinationLocation">
          {t("destinationLocationLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input
          maxLength={200}
          id="reservation-destinationLocation"
          name="destinationLocation"
          defaultValue={reservation?.destination_location ?? ""}
          placeholder={t("destinationLocationPlaceholder")}
        />
        {state.errors?.destinationLocation ? <p className="text-sm text-destructive">{state.errors.destinationLocation}</p> : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="reservation-itineraryItemId">
          {t("linkItemLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Select
          name="itineraryItemId"
          defaultValue={reservation?.itinerary_item_id ?? "none"}
          items={{
            none: t("linkItemNone"),
            ...Object.fromEntries(
              itineraryItems.map((item) => [item.id, `${formatItemDate(item.item_date, locale)} · ${item.title}`]),
            ),
          }}
        >
          <SelectTrigger id="reservation-itineraryItemId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("linkItemNone")}</SelectItem>
            {itineraryItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {formatItemDate(item.item_date, locale)} · {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.itineraryItemId ? <p className="text-sm text-destructive">{state.errors.itineraryItemId}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-paidAmount">
          {t("paidAmountLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input
          min="0"
          step="0.01"
          type="number"
          inputMode="decimal"
          id="reservation-paidAmount"
          name="paidAmount"
          defaultValue={reservation?.paid_amount ?? ""}
        />
        {state.errors?.paidAmount ? <p className="text-sm text-destructive">{state.errors.paidAmount}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-currency">
          {t("currencyLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input
          minLength={3}
          maxLength={3}
          id="reservation-currency"
          name="currency"
          defaultValue={reservation?.currency ?? ""}
          placeholder="BRL"
          className="uppercase"
        />
        {state.errors?.currency ? <p className="text-sm text-destructive">{state.errors.currency}</p> : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="reservation-payerId">
          {t("payerLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Select
          name="payerId"
          defaultValue={reservation?.payer_id ?? "none"}
          items={{
            none: t("payerNone"),
            ...Object.fromEntries(participants.map((p) => [p.user_id, p.display_name])),
          }}
        >
          <SelectTrigger id="reservation-payerId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("payerNone")}</SelectItem>
            {participants.map((participant) => (
              <SelectItem key={participant.user_id} value={participant.user_id}>{participant.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.payerId ? <p className="text-sm text-destructive">{state.errors.payerId}</p> : null}
        <p className="text-sm text-muted-foreground">{t("paidFieldsHint")}</p>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="reservation-notes">
          {t("notesLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Textarea
          maxLength={2000}
          id="reservation-notes"
          name="notes"
          defaultValue={reservation?.notes ?? ""}
          rows={3}
        />
        {state.errors?.notes ? <p className="text-sm text-destructive">{state.errors.notes}</p> : null}
      </div>

      <Button type="submit" disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? t("savePending") : reservation ? t("save") : t("add")}
      </Button>
    </form>
  );
}
