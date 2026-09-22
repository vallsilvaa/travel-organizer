"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";

import { CityAutocomplete } from "@/features/prep-catalog/city-autocomplete";
import { isContinent } from "@/features/prep-catalog/shared";

import { useActiveDayContext } from "./tab/active-day-context";
import { ActivityCombobox } from "./activity-combobox";
import { combineActivityTitle, getActivityVerbs } from "./activity-verbs";
import { saveNewItineraryItem, type NewItineraryItemActionState } from "./actions";
import { getItineraryPeriodLabels, itineraryPeriods } from "./validation";

type ItineraryDraft = {
  activity: string;
  info: string;
  date: string;
  time: string;
  endTime: string;
  period: string;
  location: string;
  approxDistance: string;
  city: string;
  country: string;
  continent: string;
  notes: string;
};

const emptyDraft: ItineraryDraft = {
  activity: "",
  info: "",
  date: "",
  time: "",
  endTime: "",
  period: "none",
  location: "",
  approxDistance: "",
  city: "",
  country: "",
  continent: "",
  notes: "",
};

function draftStorageKey(tripId: string) {
  return `itinerary-draft:${tripId}`;
}

// D4 (#231): draft lives in localStorage, per trip and per device - it never
// syncs, and every access is try/catch'd since localStorage can throw
// (private browsing, storage full) instead of just being unavailable.
function readDraft(tripId: string): ItineraryDraft | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(tripId));
    if (!raw) return null;
    return { ...emptyDraft, ...(JSON.parse(raw) as Partial<ItineraryDraft>) };
  } catch {
    return null;
  }
}

function writeDraft(tripId: string, draft: ItineraryDraft) {
  try {
    window.localStorage.setItem(draftStorageKey(tripId), JSON.stringify(draft));
  } catch {
    // Losing the draft here is strictly better than crashing the modal.
  }
}

function clearDraft(tripId: string) {
  try {
    window.localStorage.removeItem(draftStorageKey(tripId));
  } catch {
    // Same as above.
  }
}

function isDraftEmpty(draft: ItineraryDraft) {
  return Object.entries(draft).every(([field, value]) => (field === "period" ? value === "none" : !value));
}

const initialState: NewItineraryItemActionState = {};

type NewItineraryItemModalProps = {
  tripId: string;
  activitySuggestions?: string[];
  // Overridable so the trigger reads naturally with the itinerary tab's own
  // "trip" namespace copy (mirrors AddTaskFromCatalogModal's triggerLabel).
  triggerLabel?: string;
};

// The always-a-modal "Novo item de roteiro" flow (#231/R04): unlike the
// inline/standalone-Dialog split CollapsibleFormPanel and ItemActionsMenu's
// edit form use, this one is a Dialog in both browser and PWA-standalone
// mode - DialogContent already renders as a bottom sheet under
// `standalone:` classes, so no useStandalone() branching is needed here.
export function NewItineraryItemModal({ tripId, activitySuggestions, triggerLabel }: NewItineraryItemModalProps) {
  const t = useTranslations("itineraryForm");
  const tPeriods = useTranslations("categories.itineraryPeriod");
  const locale = useLocale();
  const periodLabels = getItineraryPeriodLabels(tPeriods);
  const activeDayContext = useActiveDayContext();

  const activityOptions = useMemo(
    () => Array.from(new Set([...getActivityVerbs(locale), ...(activitySuggestions ?? [])])),
    [locale, activitySuggestions],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ItineraryDraft>(emptyDraft);
  const [draftRestored, setDraftRestored] = useState(false);
  const [activity, setActivity] = useState("");
  const [info, setInfo] = useState("");
  const [hasStartTime, setHasStartTime] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const combinedTitle = combineActivityTitle(activity, info);

  const [state, formAction, pending] = useActionState(saveNewItineraryItem, initialState);
  const [lastHandledState, setLastHandledState] = useState(state);

  function resetToEmpty() {
    setActivity("");
    setInfo("");
    setHasStartTime(false);
    setDraft(emptyDraft);
    setDraftRestored(false);
    setFormKey((key) => key + 1);
  }

  function snapshotDraft(): ItineraryDraft {
    const formData = formRef.current ? new FormData(formRef.current) : null;
    return {
      activity,
      info,
      date: String(formData?.get("date") ?? ""),
      time: String(formData?.get("time") ?? ""),
      endTime: String(formData?.get("endTime") ?? ""),
      period: String(formData?.get("period") ?? "none"),
      location: String(formData?.get("location") ?? ""),
      approxDistance: String(formData?.get("approxDistance") ?? ""),
      city: String(formData?.get("city") ?? ""),
      country: String(formData?.get("country") ?? ""),
      continent: String(formData?.get("continent") ?? ""),
      notes: String(formData?.get("notes") ?? ""),
    };
  }

  // Controlled Dialog: this only ever fires from an internal close request
  // (Esc, backdrop click, the built-in X button) or the trigger opening it -
  // never from our own setOpen() calls below, so "closing" here always means
  // "save the draft" (Cancelar bypasses this entirely, see handleCancel).
  function handleOpenChange(next: boolean) {
    if (next) {
      const existingDraft = readDraft(tripId);
      setActivity(existingDraft?.activity ?? "");
      setInfo(existingDraft?.info ?? "");
      setHasStartTime(Boolean(existingDraft?.time));
      setDraft(existingDraft ?? emptyDraft);
      setDraftRestored(Boolean(existingDraft));
      setFormKey((key) => key + 1);
    } else {
      const snapshot = snapshotDraft();
      if (isDraftEmpty(snapshot)) {
        clearDraft(tripId);
      } else {
        writeDraft(tripId, snapshot);
      }
    }
    setOpen(next);
  }

  function handleCancel() {
    clearDraft(tripId);
    resetToEmpty();
    setOpen(false);
  }

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) {
      clearDraft(tripId);
      resetToEmpty();
      setOpen(false);
      if (state.createdDate) {
        activeDayContext?.setActiveDay(state.createdDate);
      }
    }
  }

  useEffect(() => {
    if (state.success) {
      toast.success(state.createdDate ? t("toastAdded") : t("toastTemplateSaved"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t]);

  const draftContinent = draft.continent && isContinent(draft.continent) ? draft.continent : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" size="lg" />}>
        {triggerLabel ?? t("newItemTrigger")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{triggerLabel ?? t("newItemTrigger")}</DialogTitle>
        </DialogHeader>

        {draftRestored ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("draftRestored")}
          </p>
        ) : null}

        <form key={formKey} ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="tripId" value={tripId} />

          <div className="space-y-2">
            <Label htmlFor="new-item-activity">{t("activityLabel")}</Label>
            <ActivityCombobox
              id="new-item-activity"
              value={activity}
              onValueChange={setActivity}
              suggestions={activityOptions}
              placeholder={t("activityPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-item-title">{t("titleLabel")} *</Label>
            <Input
              required
              maxLength={200}
              id="new-item-title"
              value={info}
              onChange={(event) => setInfo(event.target.value)}
              placeholder={t("titlePlaceholder")}
            />
            {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
          </div>
          <input type="hidden" name="title" value={combinedTitle} />
          {combinedTitle ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {t("previewLabel")} <span className="font-medium text-foreground">{combinedTitle}</span>
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="new-item-date">{t("dateLabel")} *</Label>
            {/* Not a native `required` - "Salvar" needs a date but "Salvar só
                como modelo" doesn't (D7), and a plain HTML input can't make
                that conditional on which submit button was clicked. The
                server already enforces it (validateItineraryInput's
                requireDate); errors.date surfaces the same message here. */}
            <Input id="new-item-date" name="date" type="date" defaultValue={draft.date} />
            {state.errors?.date ? <p className="text-sm text-destructive">{state.errors.date}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-item-time">{t("timeLabel")}</Label>
            <Input
              id="new-item-time"
              name="time"
              type="time"
              step="60"
              defaultValue={draft.time}
              onChange={(event) => setHasStartTime(Boolean(event.target.value))}
            />
            {state.errors?.time ? <p className="text-sm text-destructive">{state.errors.time}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-item-end-time">{t("endTimeLabel")}</Label>
            <Input
              id="new-item-end-time"
              name="endTime"
              type="time"
              step="60"
              disabled={!hasStartTime}
              defaultValue={draft.endTime}
            />
            {state.errors?.endTime ? <p className="text-sm text-destructive">{state.errors.endTime}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-item-period">{t("periodLabel")}</Label>
            <Select name="period" defaultValue={draft.period} items={{ none: t("periodNone"), ...periodLabels }}>
              <SelectTrigger id="new-item-period" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("periodNone")}</SelectItem>
                {itineraryPeriods.map((period) => (
                  <SelectItem key={period} value={period}>{periodLabels[period]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.period ? <p className="text-sm text-destructive">{state.errors.period}</p> : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-item-location">{t("locationLabel")}</Label>
            <Input
              maxLength={200}
              id="new-item-location"
              name="location"
              defaultValue={draft.location}
              placeholder={t("locationPlaceholder")}
            />
            {state.errors?.location ? <p className="text-sm text-destructive">{state.errors.location}</p> : null}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-item-approx-distance">{t("approxDistanceLabel")}</Label>
            <Input
              maxLength={100}
              id="new-item-approx-distance"
              name="approxDistance"
              defaultValue={draft.approxDistance}
            />
            {state.errors?.approxDistance ? (
              <p className="text-sm text-destructive">{state.errors.approxDistance}</p>
            ) : null}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-item-city">{t("cityLabel")}</Label>
            <CityAutocomplete
              id="new-item-city"
              defaultCity={draft.city || null}
              defaultCountry={draft.country || null}
              defaultContinent={draftContinent}
              countryInputName="country"
              cityInputName="city"
              continentInputName="continent"
            />
            {state.errors?.city ? <p className="text-sm text-destructive">{state.errors.city}</p> : null}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-item-notes">{t("notesLabel")}</Label>
            <Textarea maxLength={2000} id="new-item-notes" name="notes" defaultValue={draft.notes} rows={3} />
            {state.errors?.notes ? <p className="text-sm text-destructive">{state.errors.notes}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" name="mode" value="full" size="lg" disabled={pending}>
              {pending ? t("savePending") : t("saveNew")}
            </Button>
            <Button type="submit" name="mode" value="templateOnly" variant="outline" size="lg" disabled={pending}>
              {t("saveAsTemplateOnly")}
            </Button>
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={pending}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
