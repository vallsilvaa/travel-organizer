"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ActivityCombobox } from "@/features/itinerary/activity-combobox";
import { combineActivityTitle, getActivityVerbs } from "@/features/itinerary/activity-verbs";

import { CityAutocomplete } from "./city-autocomplete";
import { createTemplate, updateTemplate, type TemplateActionState } from "./actions";
import {
  classifications,
  getClassificationLabels,
  getPrepItemActionLabels,
  getPrepItemTypeLabels,
  getTaskCategoryLabels,
  prepItemActions,
  prepItemTypes,
  resolveActionLabel,
  taskCategories,
  timelineOffsets,
  type Classification,
  type Continent,
  type PrepItemType,
  type TaskCategory,
} from "./shared";

type TemplateFormProps = {
  template?: {
    id: string;
    title: string;
    action: string | null;
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
  onSuccess?: () => void;
  cancelSlot?: ReactNode;
  tripId?: string;
  // Lets a caller open this form pre-set to a specific catalog type - e.g.
  // the Roteiro tab's "new catalog item" entry point (#222) shouldn't make
  // the visitor manually switch away from the "preparation" default every
  // time. Ignored once editing an existing template (its own type wins).
  defaultItemType?: PrepItemType;
  // Free-text suggestions for the "Ação" combobox - values already used in
  // your own catalog templates, alongside the 6 built-in presets (#222).
  existingTemplateActions?: string[];
};

const initialState: TemplateActionState = {};

export function TemplateForm({ template, onSuccess, cancelSlot, tripId, defaultItemType, existingTemplateActions }: TemplateFormProps) {
  const t = useTranslations("templateForm");
  const tPrepItemType = useTranslations("categories.prepItemType");
  const tPrepItemAction = useTranslations("categories.prepItemAction");
  const tClassification = useTranslations("categories.classification");
  const tCategory = useTranslations("categories.task");
  const locale = useLocale();
  const prepItemTypeLabels = getPrepItemTypeLabels(tPrepItemType);
  const prepItemActionLabels = getPrepItemActionLabels(tPrepItemAction);
  const classificationLabels = getClassificationLabels(tClassification);
  const taskCategoryLabels = getTaskCategoryLabels(tCategory);

  const [state, formAction, pending] = useActionState(
    template ? updateTemplate : createTemplate,
    initialState,
  );
  const [itemType, setItemType] = useState<PrepItemType>(template?.item_type ?? defaultItemType ?? "preparation");
  const initialOffsetIsCustom = Boolean(
    template?.due_offset_days != null && !(timelineOffsets as readonly number[]).includes(template.due_offset_days),
  );
  const [dueOffsetSelection, setDueOffsetSelection] = useState<string>(
    initialOffsetIsCustom ? "custom" : template?.due_offset_days ? String(template.due_offset_days) : "",
  );
  const timelineOffsetLabels: Record<number, string> = Object.fromEntries(
    timelineOffsets.map((offset) => [
      offset,
      offset === 1 ? t("timelineOffsetEve") : t("timelineOffsetDays", { count: offset }),
    ]),
  );
  const actionSuggestions = Array.from(
    new Set([
      ...prepItemActions.map((action) => prepItemActionLabels[action]),
      ...(existingTemplateActions ?? []),
    ]),
  );
  // "Atividade" for a reusable itinerary item template is the same concept
  // (and combobox) as ItineraryForm's, not the buy/book/etc prep action
  // above - this branch feeds itinerary_items.title directly, action stops
  // being written for this item_type (#230/R03, mirrors the R02 backfill).
  const activityOptions = useMemo(
    () => Array.from(new Set([...getActivityVerbs(locale), ...(existingTemplateActions ?? [])])),
    [locale, existingTemplateActions],
  );
  const [activity, setActivity] = useState("");
  const [info, setInfo] = useState("");
  const combinedTitle = combineActivityTitle(activity, info);

  useEffect(() => {
    if (state.success && state.message) {
      toast.warning(state.message);
      onSuccess?.();
    } else if (state.success) {
      toast.success(template ? t("toastUpdated") : t("toastAdded"));
      onSuccess?.();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, template, t, onSuccess]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
      {!template && tripId ? <input type="hidden" name="tripId" value={tripId} /> : null}

      {itemType === "itinerary_item" ? (
        template ? (
          // Editing shows the saved (already unified) title as one plain
          // field, same as ItineraryForm - it's never split back into
          // activity + info parts (#230/R03/D10).
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="template-title">{t("whatLabel")}</Label>
            <Input
              required
              maxLength={200}
              id="template-title"
              name="title"
              defaultValue={template.title}
              placeholder={t("titlePlaceholder")}
            />
            {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="template-activity">
                {t("activityLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
              </Label>
              <ActivityCombobox
                id="template-activity"
                value={activity}
                onValueChange={setActivity}
                suggestions={activityOptions}
                placeholder={t("activityPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-title">{t("whatLabel")}</Label>
              <Input
                required
                maxLength={200}
                id="template-title"
                value={info}
                onChange={(event) => setInfo(event.target.value)}
                placeholder={t("titlePlaceholder")}
              />
              {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
            </div>
            <input type="hidden" name="title" value={combinedTitle} />
            {combinedTitle ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                {t("activityPreviewLabel")} <span className="font-medium text-foreground">{combinedTitle}</span>
              </p>
            ) : null}
          </>
        )
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="template-action">
              {t("actionLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
            </Label>
            <Input
              maxLength={50}
              id="template-action"
              name="action"
              list="template-action-options"
              defaultValue={resolveActionLabel(template?.action ?? null, prepItemActionLabels) ?? ""}
              placeholder={t("actionPlaceholder")}
            />
            <datalist id="template-action-options">
              {actionSuggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            {state.errors?.action ? <p className="text-sm text-destructive">{state.errors.action}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-title">{t("whatLabel")}</Label>
            <Input
              required
              maxLength={200}
              id="template-title"
              name="title"
              defaultValue={template?.title}
              placeholder={t("titlePlaceholder")}
            />
            {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="template-itemType">{t("itemTypeLabel")}</Label>
        <Select
          name="itemType"
          value={itemType}
          onValueChange={(value) => setItemType(value as PrepItemType)}
          items={prepItemTypeLabels}
        >
          <SelectTrigger id="template-itemType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prepItemTypes.map((type) => (
              <SelectItem key={type} value={type}>{prepItemTypeLabels[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.itemType ? <p className="text-sm text-destructive">{state.errors.itemType}</p> : null}
      </div>

      {itemType !== "itinerary_item" ? (
        <div className="space-y-2">
          <Label htmlFor="template-category">{t("categoryLabel")}</Label>
          <Select name="category" defaultValue={template?.category ?? "other"} items={taskCategoryLabels}>
            <SelectTrigger id="template-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {taskCategories.map((category) => (
                <SelectItem key={category} value={category}>{taskCategoryLabels[category]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.category ? <p className="text-sm text-destructive">{state.errors.category}</p> : null}
        </div>
      ) : (
        <input type="hidden" name="category" value="other" />
      )}

      {itemType !== "itinerary_item" ? (
        <div className="space-y-2">
          <Label htmlFor="template-classification">{t("classificationLabel")}</Label>
          <Select
            name="classification"
            defaultValue={template?.classification ?? "recommended"}
            items={classificationLabels}
          >
            <SelectTrigger id="template-classification" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classifications.map((classification) => (
                <SelectItem key={classification} value={classification}>
                  {classificationLabels[classification]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.classification ? <p className="text-sm text-destructive">{state.errors.classification}</p> : null}
        </div>
      ) : (
        // A reusable itinerary item has no "required/recommended/optional"
        // concept - classification only matters for preparation checklist
        // items - but the column is required, so a stable default is sent.
        <input type="hidden" name="classification" value="recommended" />
      )}

      <div className="space-y-2">
        <Label htmlFor="template-location">{t("countryLabel")}</Label>
        <CityAutocomplete
          id="template-location"
          defaultCity={template?.city ?? null}
          defaultCountry={template?.country}
          defaultContinent={template?.continent ?? null}
          countryInputName="country"
          cityInputName="city"
          continentInputName="continent"
          required
        />
        {state.errors?.country ? <p className="text-sm text-destructive">{state.errors.country}</p> : null}
        {state.errors?.city ? <p className="text-sm text-destructive">{state.errors.city}</p> : null}
      </div>

      {itemType === "preparation" ? (
        <div className="space-y-2">
          <Label htmlFor="template-dueOffsetDays">{t("dueOffsetDaysLabel")}</Label>
          <Select
            value={dueOffsetSelection}
            onValueChange={(value) => setDueOffsetSelection(value ?? "")}
            items={{
              ...Object.fromEntries(timelineOffsets.map((offset) => [String(offset), timelineOffsetLabels[offset]])),
              custom: t("dueOffsetDaysCustom"),
            }}
          >
            <SelectTrigger id="template-dueOffsetDays" className="w-full">
              <SelectValue placeholder={t("dueOffsetDaysPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {timelineOffsets.map((offset) => (
                <SelectItem key={offset} value={String(offset)}>{timelineOffsetLabels[offset]}</SelectItem>
              ))}
              <SelectItem value="custom">{t("dueOffsetDaysCustom")}</SelectItem>
            </SelectContent>
          </Select>
          {dueOffsetSelection === "custom" ? (
            <Input
              required
              min={0}
              max={730}
              step={1}
              type="number"
              inputMode="numeric"
              id="template-dueOffsetDaysCustom"
              name="dueOffsetDays"
              defaultValue={initialOffsetIsCustom ? (template?.due_offset_days ?? undefined) : undefined}
              placeholder={t("dueOffsetDaysCustomPlaceholder")}
              className="mt-2"
            />
          ) : (
            <input type="hidden" name="dueOffsetDays" value={dueOffsetSelection} />
          )}
          {state.errors?.dueOffsetDays ? <p className="text-sm text-destructive">{state.errors.dueOffsetDays}</p> : null}
        </div>
      ) : null}

      {itemType !== "itinerary_item" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="template-currency">
              {t("currencyLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
            </Label>
            <Input
              minLength={3}
              maxLength={3}
              id="template-currency"
              name="currency"
              defaultValue={template?.currency ?? ""}
              placeholder="BRL"
              className="uppercase"
            />
            {state.errors?.currency ? <p className="text-sm text-destructive">{state.errors.currency}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-estimatedAmount">
              {t("estimatedAmountLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
            </Label>
            <Input
              min="0"
              step="0.01"
              type="number"
              inputMode="decimal"
              id="template-estimatedAmount"
              name="estimatedAmount"
              defaultValue={template?.estimated_amount ?? ""}
            />
            {state.errors?.estimatedAmount ? <p className="text-sm text-destructive">{state.errors.estimatedAmount}</p> : null}
          </div>
        </>
      ) : null}

      {itemType === "document_request" ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="template-documentInstructions">{t("documentInstructionsLabel")}</Label>
          <Textarea
            maxLength={2000}
            id="template-documentInstructions"
            name="documentInstructions"
            defaultValue={template?.document_instructions ?? ""}
            placeholder={t("documentInstructionsPlaceholder")}
          />
          {state.errors?.documentInstructions ? (
            <p className="text-sm text-destructive">{state.errors.documentInstructions}</p>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground sm:col-span-2">{t("costsHint")}</p>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? t("savePending") : template ? t("save") : t("add")}
        </Button>
        {cancelSlot}
      </div>
    </form>
  );
}
