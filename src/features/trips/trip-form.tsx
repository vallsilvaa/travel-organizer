"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IANA_TIME_ZONES } from "@/lib/timezone";

import { createTrip, updateTrip, type CreateTripState } from "./actions";
import { DestinationListField, type DestinationFieldValue } from "./destination-list-field";

const initialState: CreateTripState = {};

type TripFormProps = {
  trip?: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    timezone: string;
    destinations?: DestinationFieldValue[];
  };
  cancelSlot?: ReactNode;
  extraFields?: ReactNode;
  onSuccess?: () => void;
};

export function TripForm({ trip, cancelSlot, extraFields, onSuccess }: TripFormProps = {}) {
  const t = useTranslations("trip.editForm");
  const [state, formAction, pending] = useActionState(
    trip ? updateTrip : createTrip,
    initialState,
  );
  const timezoneRef = useRef<HTMLSelectElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);

  // Server-rendered markup omits `min` (the server has no notion of "the
  // visitor's today") - only a *new* trip's start date gets one, patched in
  // once the browser's own date is known client-side, same reasoning as the
  // timezone auto-detect below.
  useEffect(() => {
    if (trip || !startDateRef.current) {
      return;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDateRef.current.min = tomorrow.toISOString().slice(0, 10);
  }, [trip]);

  // Pre-selects the visitor's own zone for a *new* trip, once the browser's
  // timezone is known client-side. Server-rendered markup always defaults
  // to UTC, so there's nothing to reconcile during hydration - this only
  // patches the select after mount.
  useEffect(() => {
    if (trip || !timezoneRef.current) {
      return;
    }
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (IANA_TIME_ZONES.includes(detected)) {
        timezoneRef.current.value = detected;
      }
    } catch {
      // Keep the UTC default.
    }
  }, [trip]);

  useEffect(() => {
    if (state.success) {
      if (state.message) {
        toast.success(state.message);
      }
      onSuccess?.();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="mt-6 grid gap-5 sm:grid-cols-2">
      {trip ? <input type="hidden" name="tripId" value={trip.id} /> : null}
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">{t("titleLabel")}</Label>
        <Input
          required
          maxLength={200}
          id="title"
          name="title"
          placeholder={t("titlePlaceholder")}
          defaultValue={trip?.title}
          aria-describedby={state.errors?.title ? "title-error" : undefined}
        />
        {state.errors?.title ? (
          <p id="title-error" className="text-sm text-destructive">
            {state.errors.title}
          </p>
        ) : null}
      </div>

      <div className="sm:col-span-2">
        <DestinationListField initialDestinations={trip?.destinations} />
        {state.errors?.destinations ? (
          <p className="text-sm text-destructive">{state.errors.destinations}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">{t("startDateLabel")}</Label>
        <Input
          required
          ref={startDateRef}
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={trip?.start_date}
          aria-describedby={state.errors?.startDate ? "start-date-error" : undefined}
        />
        {state.errors?.startDate ? (
          <p id="start-date-error" className="text-sm text-destructive">
            {state.errors.startDate}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">{t("endDateLabel")}</Label>
        <Input
          required
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={trip?.end_date}
          aria-describedby={state.errors?.endDate ? "end-date-error" : undefined}
        />
        {state.errors?.endDate ? (
          <p id="end-date-error" className="text-sm text-destructive">
            {state.errors.endDate}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="timezone">{t("timezoneLabel")}</Label>
        <select
          required
          ref={timezoneRef}
          id="timezone"
          name="timezone"
          defaultValue={trip?.timezone ?? "UTC"}
          aria-describedby={state.errors?.timezone ? "timezone-error" : undefined}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        >
          {IANA_TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          {t("timezoneHint")}
        </p>
        {state.errors?.timezone ? (
          <p id="timezone-error" className="text-sm text-destructive">
            {state.errors.timezone}
          </p>
        ) : null}
      </div>

      {extraFields}

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} size="lg">
          {pending
            ? trip ? t("savePending") : t("createPending")
            : trip ? t("save") : t("create")}
        </Button>
        {cancelSlot}
      </div>
    </form>
  );
}
