"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

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
};

// R05 (#232): single-select search over the visitor's own itinerary_item
// templates - unlike AddTaskFromCatalogModal (multi-select checkboxes that
// bulk-apply straight onto the trip's start_date without asking, and show an
// "already applied" badge), picking one item here transitions into
// NewItineraryItemModal's own form via its `fromTemplate` prop, so the date
// stays a required, per-item choice instead of a silent default. D3 (#229)
// already dropped the DB constraint blocking the same template from being
// used on more than one day, so there's no "already applied" state to track
// here either. This search dialog and the item-form dialog are mutually
// exclusive (`selected` gates which one is mounted), so there's never a
// moment where both could be open at once.
export function ItineraryCatalogModal({ tripId, templates, activitySuggestions, triggerLabel }: ItineraryCatalogModalProps) {
  const t = useTranslations("trip.itinerary");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ItineraryCatalogTemplate | null>(null);

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
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
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
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(template);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col gap-1 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <span className="font-semibold text-slate-950">{template.title}</span>
                    {template.location ? <span className="text-sm text-slate-600">{template.location}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
    </>
  );
}
