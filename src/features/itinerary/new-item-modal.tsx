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

// R05 (#232): ItineraryCatalogModal mounts a fresh instance of this
// component, already open, once a single existing template is picked -
// `open`/`onOpenChange` are then driven by that caller instead of an
// internal trigger, and `title`/`location` pre-fill the form. Saving
// submits mode="fromTemplate" so the server reuses that exact template_id
// (see saveNewItineraryItem) instead of upserting a title/location match -
// the template itself is never created or modified from this path, so
// "Salvar só como modelo" (which only makes sense when there's no template
// yet) doesn't apply here either.
type NewItineraryItemModalFromTemplate = {
  id: string;
  title: string;
  location: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type NewItineraryItemModalProps = {
  tripId: string;
  activitySuggestions?: string[];
  // Overridable so the trigger reads naturally with the itinerary tab's own
  // "trip" namespace copy (mirrors AddTaskFromCatalogModal's triggerLabel).
  triggerLabel?: string;
  fromTemplate?: NewItineraryItemModalFromTemplate;
};

// The always-a-modal "Novo item de roteiro" flow (#231/R04): unlike the
// inline/standalone-Dialog split CollapsibleFormPanel and ItemActionsMenu's
// edit form use, this one is a Dialog in both browser and PWA-standalone
// mode - DialogContent already renders as a bottom sheet under
// `standalone:` classes, so no useStandalone() branching is needed here.
export function NewItineraryItemModal({ tripId, activitySuggestions, triggerLabel, fromTemplate }: NewItineraryItemModalProps) {
  const t = useTranslations("itineraryForm");
  const tPeriods = useTranslations("categories.itineraryPeriod");
  const locale = useLocale();
  const periodLabels = getItineraryPeriodLabels(tPeriods);
  const activeDayContext = useActiveDayContext();

  const activityOptions = useMemo(
    () => Array.from(new Set([...getActivityVerbs(locale), ...(activitySuggestions ?? [])])),
    [locale, activitySuggestions],
  );

  const [internalOpen, setInternalOpen] = useState(false);
  const open = fromTemplate ? fromTemplate.open : internalOpen;
  // Lazy initializers: ItineraryCatalogModal mounts a brand new instance of
  // this component per selection (see its own comment), so seeding these
  // from `fromTemplate` here - rather than in handleOpenChange's "next"
  // branch below, which never runs for a component that mounts already
  // open - is enough; there's no "reopen with a different template" case to
  // handle for the same mounted instance.
  const [draft, setDraft] = useState<ItineraryDraft>(() =>
    fromTemplate ? { ...emptyDraft, location: fromTemplate.location ?? "" } : emptyDraft,
  );
  const [draftRestored, setDraftRestored] = useState(false);
  const [activity, setActivity] = useState("");
  const [info, setInfo] = useState(() => fromTemplate?.title ?? "");
  const [hasStartTime, setHasStartTime] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const combinedTitle = combineActivityTitle(activity, info);

  const [state, formAction, pending] = useActionState(saveNewItineraryItem, initialState);
  const [lastHandledState, setLastHandledState] = useState(state);

  // ItineraryCatalogModal passes a new `onOpenChange` closure every time it
  // re-renders (it's an inline arrow function, not memoized) - reading it
  // through a ref instead of putting `fromTemplate` in the effect's deps
  // below means an unrelated parent re-render can't itself re-trigger the
  // effect (and re-fire the success toast) while `state.success` is still
  // true from a previous, already-handled action.
  const fromTemplateRef = useRef(fromTemplate);
  useEffect(() => {
    fromTemplateRef.current = fromTemplate;
  });

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

  function closeModal(next: boolean) {
    if (fromTemplate) {
      fromTemplate.onOpenChange(next);
    } else {
      setInternalOpen(next);
    }
  }

  // Controlled Dialog: this only ever fires from an internal close request
  // (Esc, backdrop click, the built-in X button) or the trigger opening it -
  // never from our own closeModal() calls below, so "closing" here always
  // means "save the draft" (Cancelar bypasses this entirely, see
  // handleCancel). The draft read/write is skipped entirely when
  // `fromTemplate` is set - a stray Esc/backdrop close from that flow must
  // not overwrite the regular "Novo item" draft with template-prefilled
  // content, and there's no "reopen" to restore into anyway (see the
  // lazy-initializer comment above).
  function handleOpenChange(next: boolean) {
    if (next && !fromTemplate) {
      const existingDraft = readDraft(tripId);
      setActivity(existingDraft?.activity ?? "");
      setInfo(existingDraft?.info ?? "");
      setHasStartTime(Boolean(existingDraft?.time));
      setDraft(existingDraft ?? emptyDraft);
      setDraftRestored(Boolean(existingDraft));
      setFormKey((key) => key + 1);
    } else if (!next && !fromTemplate) {
      const snapshot = snapshotDraft();
      if (isDraftEmpty(snapshot)) {
        clearDraft(tripId);
      } else {
        writeDraft(tripId, snapshot);
      }
    }
    closeModal(next);
  }

  function handleCancel() {
    clearDraft(tripId);
    resetToEmpty();
    closeModal(false);
  }

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) {
      clearDraft(tripId);
      resetToEmpty();
      // Only this component's own state (setInternalOpen) - safe here, same
      // as the rest of this block. The fromTemplate case (closing via a
      // parent-owned callback) is handled in the effect below instead; see
      // its comment for why that call can't live in this render-phase block.
      if (!fromTemplate) {
        closeModal(false);
      }
    }
  }

  // Extracted so the effect below can depend on the setter itself (stable
  // across renders, like every useState setter) instead of the
  // ActiveDayProvider context value object, which is a new object on every
  // render and would otherwise re-fire the effect - and the success toast
  // with it - every time the active day actually changes.
  const setActiveDay = activeDayContext?.setActiveDay;

  useEffect(() => {
    if (state.success) {
      toast.success(state.createdDate ? t("toastAdded") : t("toastTemplateSaved"));
      // Switching the active day-tab updates ActiveDayProvider, a different
      // component's state - doing that mid-render (as the block above does
      // for this component's own state) is invalid React and only warns/
      // silently drops the update instead of applying it.
      if (state.createdDate) {
        setActiveDay?.(state.createdDate);
      }
      // fromTemplate.onOpenChange updates a *different* component's state
      // (ItineraryCatalogModal wires it up to its own reset()) - same
      // reasoning as the active-day switch above. Calling it directly
      // (not through the closeModal() wrapper, which also covers the
      // render-phase !fromTemplate branch above) keeps this call opaque to
      // the lint rule that flags effects calling a *local* state setter -
      // this is a parent-owned callback, not one of this component's own.
      fromTemplateRef.current?.onOpenChange(false);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t, setActiveDay]);

  const draftContinent = draft.continent && isContinent(draft.continent) ? draft.continent : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {fromTemplate ? null : (
        <DialogTrigger render={<Button type="button" size="lg" />}>
          {triggerLabel ?? t("newItemTrigger")}
        </DialogTrigger>
      )}
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
          {fromTemplate ? <input type="hidden" name="templateId" value={fromTemplate.id} /> : null}

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
            <Button type="submit" name="mode" value={fromTemplate ? "fromTemplate" : "full"} size="lg" disabled={pending}>
              {pending ? t("savePending") : t("saveNew")}
            </Button>
            {fromTemplate ? null : (
              <Button type="submit" name="mode" value="templateOnly" variant="outline" size="lg" disabled={pending}>
                {t("saveAsTemplateOnly")}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={pending}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
