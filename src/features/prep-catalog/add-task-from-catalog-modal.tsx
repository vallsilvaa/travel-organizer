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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { applyPrepTemplate, type ApplyTemplateActionState } from "./actions";
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

type Participant = { user_id: string; display_name: string; role: string };
type ItineraryItemOption = { id: string; title: string };

type Labels = {
  taskCategoryLabels: Record<TaskCategory, string>;
  prepItemTypeLabels: Record<PrepItemType, string>;
  classificationLabels: Record<Classification, string>;
  continentLabels: Record<Continent, string>;
};

type AddTaskFromCatalogModalProps = Labels & {
  templates: CatalogTemplate[];
  tripId: string;
  participants: Participant[];
  itineraryItems: ItineraryItemOption[];
  appliedTemplateIds: string[];
};

export function AddTaskFromCatalogModal({
  templates,
  tripId,
  participants,
  itineraryItems,
  appliedTemplateIds,
  ...labels
}: AddTaskFromCatalogModalProps) {
  const appliedIds = new Set(appliedTemplateIds);
  const t = useTranslations("trip.preparation.catalogModal");
  const tTrigger = useTranslations("trip.preparation");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogTemplate | null>(null);

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
    setSelected(null);
  }

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
        {tTrigger("addTaskFromCatalog")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {selected ? (
          <TemplatePreviewAndConfirm
            template={selected}
            tripId={tripId}
            participants={participants}
            itineraryItems={itineraryItems}
            {...labels}
            onBack={() => setSelected(null)}
            onSuccess={() => setOpen(false)}
          />
        ) : (
          <div className="space-y-4">
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
              <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noResults")}</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {filtered.map((template) => {
                  const alreadyAdded = appliedIds.has(template.id);
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => setSelected(template)}
                        className="flex w-full flex-col items-start gap-1 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                      >
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type TemplatePreviewAndConfirmProps = Labels & {
  template: CatalogTemplate;
  tripId: string;
  participants: Participant[];
  itineraryItems: ItineraryItemOption[];
  onBack: () => void;
  onSuccess: () => void;
};

const initialState: ApplyTemplateActionState = {};

function TemplatePreviewAndConfirm({
  template,
  tripId,
  participants,
  itineraryItems,
  taskCategoryLabels,
  prepItemTypeLabels,
  classificationLabels,
  continentLabels,
  onBack,
  onSuccess,
}: TemplatePreviewAndConfirmProps) {
  const t = useTranslations("trip.preparation.catalogModal");
  const [state, formAction, pending] = useActionState(applyPrepTemplate, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(t("toastApplied"));
      onSuccess();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t, onSuccess]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-950">{template.title}</h3>
          <Badge variant="outline">{prepItemTypeLabels[template.item_type]}</Badge>
          <Badge variant="outline">{classificationLabels[template.classification]}</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {[
            taskCategoryLabels[template.category],
            template.continent ? continentLabels[template.continent] : null,
            template.country,
            template.city,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {template.due_offset_days ? (
          <p className="mt-1 text-sm text-slate-600">
            {t("daysBeforeDeparture", { count: template.due_offset_days })}
          </p>
        ) : null}
        {template.document_instructions ? (
          <p className="mt-2 text-sm text-slate-600">{template.document_instructions}</p>
        ) : null}
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tripId" value={tripId} />
        <input type="hidden" name="templateId" value={template.id} />

        {template.item_type !== "itinerary_item" ? (
          <div className="space-y-2">
            <Label htmlFor="catalog-assignedTo">{t("assignedToLabel")}</Label>
            <Select
              name="assignedTo"
              defaultValue="none"
              items={{
                none: t("assignedToNone"),
                ...Object.fromEntries(participants.map((p) => [p.user_id, p.display_name])),
              }}
            >
              <SelectTrigger id="catalog-assignedTo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("assignedToNone")}</SelectItem>
                {participants.map((participant) => (
                  <SelectItem key={participant.user_id} value={participant.user_id}>
                    {participant.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {template.item_type !== "itinerary_item" ? (
          <div className="space-y-2">
            <Label htmlFor="catalog-itineraryItemId">{t("itineraryLinkLabel")}</Label>
            <Select
              name="itineraryItemId"
              defaultValue="none"
              items={{
                none: t("itineraryLinkNone"),
                ...Object.fromEntries(itineraryItems.map((item) => [item.id, item.title])),
              }}
            >
              <SelectTrigger id="catalog-itineraryItemId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("itineraryLinkNone")}</SelectItem>
                {itineraryItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} size="lg">
            {pending ? t("confirmPending") : t("confirm")}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onBack}>
            {t("back")}
          </Button>
        </div>
      </form>
    </div>
  );
}
