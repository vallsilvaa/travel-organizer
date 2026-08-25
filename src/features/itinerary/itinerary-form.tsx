"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  createItineraryItem,
  updateItineraryItem,
  type ItineraryActionState,
} from "./actions";

type ItineraryFormProps = {
  item?: {
    id: string;
    item_date: string;
    start_time: string | null;
    title: string;
    location: string | null;
    notes: string | null;
  };
  tripId: string;
};

const initialState: ItineraryActionState = {};

export function ItineraryForm({ item, tripId }: ItineraryFormProps) {
  const t = useTranslations("itineraryForm");
  const tCommon = useTranslations("common");
  const action = item ? updateItineraryItem : createItineraryItem;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(item ? t("toastUpdated") : t("toastAdded"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, item, t]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="date">{t("dateLabel")}</Label>
        <Input required id="date" name="date" type="date" defaultValue={item?.item_date} />
        {state.errors?.date ? <p className="text-sm text-destructive">{state.errors.date}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="time">
          {t("timeLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input id="time" name="time" type="time" defaultValue={item?.start_time?.slice(0, 5)} />
        {state.errors?.time ? <p className="text-sm text-destructive">{state.errors.time}</p> : null}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">{t("titleLabel")}</Label>
        <Input
          required
          maxLength={200}
          id="title"
          name="title"
          defaultValue={item?.title}
          placeholder={t("titlePlaceholder")}
        />
        {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="location">
          {t("locationLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Input
          maxLength={200}
          id="location"
          name="location"
          defaultValue={item?.location ?? ""}
          placeholder={t("locationPlaceholder")}
        />
        {state.errors?.location ? <p className="text-sm text-destructive">{state.errors.location}</p> : null}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="notes">
          {t("notesLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
        </Label>
        <Textarea
          maxLength={2000}
          id="notes"
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={3}
        />
        {state.errors?.notes ? <p className="text-sm text-destructive">{state.errors.notes}</p> : null}
      </div>
      <Button type="submit" disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? t("savePending") : item ? t("save") : t("add")}
      </Button>
    </form>
  );
}
