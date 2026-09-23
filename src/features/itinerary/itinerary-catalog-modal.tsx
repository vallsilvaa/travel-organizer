"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { addItineraryItemsFromTemplates, type BatchItineraryActionState } from "./actions";
import { NewItineraryItemModal } from "./new-item-modal";

export type ItineraryCatalogTemplate = {
  id: string;
  title: string;
  location: string | null;
};

type ItineraryCatalogModalProps = {
  tripId: string;
  templates: ItineraryCatalogTemplate[];
  activitySuggestions?: string[];
  triggerLabel?: string;
  // R06 (#233): bounds for each per-item date input in the batch step below.
  tripStartDate: string;
  tripEndDate: string;
};

const initialBatchState: BatchItineraryActionState = {};

// R06 (#233): the per-item date step opened once 2+ templates are checked
// below - a second, mutually-exclusive Dialog from the search one, same as
// `selected` already gates NewItineraryItemModal for the single-pick path.
// Kept in this file (not new-item-modal.tsx) since it never touches that
// form: only title + a required date per item, nothing else from R04's
// fuller form applies to a batch add.
function ItineraryBatchDateModal({
  tripId,
  templates,
  tripStartDate,
  tripEndDate,
  onOpenChange,
}: {
  tripId: string;
  templates: ItineraryCatalogTemplate[];
  tripStartDate: string;
  tripEndDate: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("trip.itinerary");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(addItineraryItemsFromTemplates, initialBatchState);
  const [lastHandledState, setLastHandledState] = useState(state);

  const allDated = templates.every((template) => Boolean(dates[template.id]));

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) {
      onOpenChange(false);
    }
  }

  useEffect(() => {
    if (state.success) {
      toast.success(t("catalogModalToastAdded", { count: state.addedCount ?? 0 }));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("catalogModalDateStepTitle")}</DialogTitle>
          <DialogDescription>{t("catalogModalDateStepDescription")}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tripId" value={tripId} />

          <ul className="max-h-80 space-y-4 overflow-y-auto">
            {templates.map((template) => (
              <li key={template.id} className="space-y-2">
                <input type="hidden" name="templateIds" value={template.id} />
                <Label htmlFor={`batch-date-${template.id}`}>
                  {t("catalogModalDateAria", { title: template.title })}
                </Label>
                <Input
                  required
                  id={`batch-date-${template.id}`}
                  type="date"
                  name={`date-${template.id}`}
                  min={tripStartDate}
                  max={tripEndDate}
                  value={dates[template.id] ?? ""}
                  onChange={(event) =>
                    setDates((previous) => ({ ...previous, [template.id]: event.target.value }))
                  }
                />
                {state.itemErrors?.[template.id] ? (
                  <p className="text-sm text-destructive">{state.itemErrors[template.id]}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("catalogModalCancel")}
            </Button>
            <Button type="submit" size="lg" disabled={pending || !allDated}>
              {pending ? t("catalogModalAddPending") : t("catalogModalAddSelected", { count: templates.length })}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// R05 (#232) + R06 (#233): search over the visitor's own itinerary_item
// templates, unlike AddTaskFromCatalogModal (multi-select checkboxes that
// bulk-apply straight onto the trip's start_date without asking, and show an
// "already applied" badge). Two ways to pick here:
//  - clicking a row directly (unchanged since R05) selects that one template
//    and transitions straight into NewItineraryItemModal's own form via its
//    `fromTemplate` prop, so the date stays a required, per-item choice.
//  - checking 2+ rows and hitting "Continuar" opens ItineraryBatchDateModal
//    above instead, one required date input per checked item.
// D3 (#229) already dropped the DB constraint blocking the same template
// from being used on more than one day, so there's no "already applied"
// state to track for either path. The search dialog, the single-item form
// dialog, and the batch date dialog are all mutually exclusive (`selected`
// and `batchTemplates` gate which one - if any - is mounted), so there's
// never a moment where more than one could be open at once.
export function ItineraryCatalogModal({
  tripId,
  templates,
  activitySuggestions,
  triggerLabel,
  tripStartDate,
  tripEndDate,
}: ItineraryCatalogModalProps) {
  const t = useTranslations("trip.itinerary");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ItineraryCatalogTemplate | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [batchTemplates, setBatchTemplates] = useState<ItineraryCatalogTemplate[] | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return templates;
    }
    return templates.filter((template) =>
      [template.title, template.location].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [templates, query]);

  function reset() {
    setQuery("");
    setSelected(null);
    setCheckedIds(new Set());
  }

  function toggleChecked(id: string) {
    setCheckedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleContinue() {
    const chosen = templates.filter((template) => checkedIds.has(template.id));
    if (chosen.length === 1) {
      setSelected(chosen[0]);
    } else if (chosen.length > 1) {
      setBatchTemplates(chosen);
    }
    setCheckedIds(new Set());
    setOpen(false);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setCheckedIds(new Set());
          }
        }}
      >
        <DialogTrigger render={<Button type="button" size="lg" variant="outline" />}>
          {triggerLabel ?? t("addFromCatalog")}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("catalogModalTitle")}</DialogTitle>
            <DialogDescription>{t("catalogModalDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="itinerary-catalog-search">{t("catalogModalSearchLabel")}</Label>
            <Input
              id="itinerary-catalog-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("catalogModalSearchPlaceholder")}
            />
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("catalogModalNoTemplates")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("catalogModalNoResults")}</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    aria-label={t("catalogModalSelectAria", { title: template.title })}
                    checked={checkedIds.has(template.id)}
                    onChange={() => toggleChecked(template.id)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(template);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col gap-1 text-left"
                  >
                    <span className="font-semibold text-slate-950">{template.title}</span>
                    {template.location ? <span className="text-sm text-slate-600">{template.location}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {checkedIds.size > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-600">{t("catalogModalSelectedCount", { count: checkedIds.size })}</span>
              <Button type="button" size="lg" onClick={handleContinue}>
                {t("catalogModalContinue")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {selected ? (
        <NewItineraryItemModal
          tripId={tripId}
          activitySuggestions={activitySuggestions}
          triggerLabel={t("catalogModalFormTitle")}
          fromTemplate={{
            id: selected.id,
            title: selected.title,
            location: selected.location,
            open: true,
            onOpenChange: (next) => {
              if (!next) reset();
            },
          }}
        />
      ) : null}

      {batchTemplates ? (
        <ItineraryBatchDateModal
          tripId={tripId}
          templates={batchTemplates}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onOpenChange={(next) => {
            if (!next) setBatchTemplates(null);
          }}
        />
      ) : null}
    </>
  );
}
