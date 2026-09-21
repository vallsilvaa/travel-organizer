"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { TaskCategory } from "@/features/tasks/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { applyPrepTemplates, type ApplyTemplateActionState } from "./actions";
import type { Classification, Continent, PrepItemType } from "./shared";

type CatalogTemplate = {
  id: string;
  title: string;
  item_type: PrepItemType;
  category: TaskCategory;
  continent: Continent | null;
  country: string;
  city: string | null;
  classification: Classification;
  due_offset_days: number | null;
  currency: string | null;
  estimated_amount: string | null;
  document_instructions: string | null;
};

type Labels = {
  taskCategoryLabels: Record<TaskCategory, string>;
  prepItemTypeLabels: Record<PrepItemType, string>;
  classificationLabels: Record<Classification, string>;
  continentLabels: Record<Continent, string>;
};

type AddTaskFromCatalogModalProps = Labels & {
  templates: CatalogTemplate[];
  tripId: string;
  appliedTemplateIds: string[];
  // Every one of these defaults to the Preparação-tab copy (the modal's
  // original, only home) - overridable so the exact same component reads
  // naturally when reused for the itinerary catalog (#222) instead of
  // forking it just to change a few strings.
  triggerLabel?: string;
  title?: string;
  description?: string;
  noTemplatesMessage?: string;
  toastMessage?: string;
};

const initialState: ApplyTemplateActionState = {};

export function AddTaskFromCatalogModal({
  templates,
  tripId,
  appliedTemplateIds,
  triggerLabel,
  title,
  description,
  noTemplatesMessage,
  toastMessage,
  ...labels
}: AddTaskFromCatalogModalProps) {
  const appliedIds = new Set(appliedTemplateIds);
  const t = useTranslations("trip.preparation.catalogModal");
  const tTrigger = useTranslations("trip.preparation");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(applyPrepTemplates, initialState);
  const [lastHandledState, setLastHandledState] = useState(state);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return templates;
    }
    return templates.filter((template) => {
      const haystack = [
        template.title,
        labels.taskCategoryLabels[template.category],
        labels.prepItemTypeLabels[template.item_type],
        template.country,
        template.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [templates, query, labels.taskCategoryLabels, labels.prepItemTypeLabels]);

  function reset() {
    setQuery("");
    setSelectedIds(new Set());
  }

  function toggle(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) {
      setOpen(false);
      setQuery("");
      setSelectedIds(new Set());
    }
  }

  useEffect(() => {
    if (state.success) {
      toast.success(toastMessage ?? t("toastApplied", { count: state.appliedCount ?? 0 }));
      if (state.duplicateCount) {
        toast.message(t("toastPartiallyApplied", { applied: state.appliedCount ?? 0, skipped: state.duplicateCount }));
      }
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t, toastMessage]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger render={<Button type="button" size="lg" variant="outline" />}>
        {triggerLabel ?? tTrigger("addTaskFromCatalog")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? t("title")}</DialogTitle>
          <DialogDescription>{description ?? t("description")}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tripId" value={tripId} />
          {Array.from(selectedIds).map((id) => (
            <input key={id} type="hidden" name="templateIds" value={id} />
          ))}

          <div className="space-y-2">
            <Label htmlFor="catalog-search">{t("searchLabel")}</Label>
            <Input
              id="catalog-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{noTemplatesMessage ?? t("noTemplates")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((template) => {
                const alreadyAdded = appliedIds.has(template.id);
                const checked = selectedIds.has(template.id);
                return (
                  <li key={template.id}>
                    <label
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left transition",
                        alreadyAdded
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer hover:border-sky-300 hover:bg-sky-50",
                        checked && !alreadyAdded && "border-sky-400 bg-sky-50",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        disabled={alreadyAdded}
                        checked={checked}
                        onChange={() => toggle(template.id)}
                      />
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-950">{template.title}</span>
                          <Badge variant="outline">{labels.prepItemTypeLabels[template.item_type]}</Badge>
                          {alreadyAdded ? <Badge>{t("alreadyAdded")}</Badge> : null}
                        </div>
                        <span className="text-sm text-slate-600">
                          {[labels.taskCategoryLabels[template.category], template.country, template.city]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-600">{t("selectedCount", { count: selectedIds.size })}</span>
            <div className="flex items-center gap-3">
              <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
              <Button type="submit" size="lg" disabled={pending || selectedIds.size === 0}>
                {pending ? t("addSelectedPending") : t("addSelected", { count: selectedIds.size })}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
