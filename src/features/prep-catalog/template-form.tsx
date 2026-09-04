"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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

import { createTemplate, updateTemplate, type TemplateActionState } from "./actions";
import {
  classifications,
  continents,
  getClassificationLabels,
  getContinentLabels,
  getPrepItemTypeLabels,
  getTaskCategoryLabels,
  prepItemTypes,
  taskCategories,
  type Classification,
  type Continent,
  type PrepItemType,
  type TaskCategory,
} from "./shared";

type TemplateFormProps = {
  template?: {
    id: string;
    title: string;
    item_type: PrepItemType;
    category: TaskCategory;
    continent: Continent;
    country: string;
    city: string | null;
    classification: Classification;
    due_offset_days: number;
    currency: string | null;
    estimated_amount: string | null;
    document_instructions: string | null;
  };
};

const initialState: TemplateActionState = {};

export function TemplateForm({ template }: TemplateFormProps) {
  const t = useTranslations("templateForm");
  const tPrepItemType = useTranslations("categories.prepItemType");
  const tClassification = useTranslations("categories.classification");
  const tContinent = useTranslations("categories.continent");
  const tCategory = useTranslations("categories.task");
  const prepItemTypeLabels = getPrepItemTypeLabels(tPrepItemType);
  const classificationLabels = getClassificationLabels(tClassification);
  const continentLabels = getContinentLabels(tContinent);
  const taskCategoryLabels = getTaskCategoryLabels(tCategory);

  const [state, formAction, pending] = useActionState(
    template ? updateTemplate : createTemplate,
    initialState,
  );
  const [itemType, setItemType] = useState<PrepItemType>(template?.item_type ?? "preparation");

  useEffect(() => {
    if (state.success) {
      toast.success(template ? t("toastUpdated") : t("toastAdded"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, template, t]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {template ? <input type="hidden" name="templateId" value={template.id} /> : null}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="template-title">{t("titleLabel")}</Label>
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

      <div className="space-y-2">
        <Label htmlFor="template-continent">{t("continentLabel")}</Label>
        <Select name="continent" defaultValue={template?.continent} items={continentLabels}>
          <SelectTrigger id="template-continent" className="w-full">
            <SelectValue placeholder={t("continentPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {continents.map((continent) => (
              <SelectItem key={continent} value={continent}>{continentLabels[continent]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.continent ? <p className="text-sm text-destructive">{state.errors.continent}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-country">{t("countryLabel")}</Label>
        <Input
          required
          maxLength={100}
          id="template-country"
          name="country"
          defaultValue={template?.country}
          placeholder={t("countryPlaceholder")}
        />
        {state.errors?.country ? <p className="text-sm text-destructive">{state.errors.country}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-city">
          {t("cityLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          maxLength={200}
          id="template-city"
          name="city"
          defaultValue={template?.city ?? ""}
          placeholder={t("cityPlaceholder")}
        />
        {state.errors?.city ? <p className="text-sm text-destructive">{state.errors.city}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-dueOffsetDays">{t("dueOffsetDaysLabel")}</Label>
        <Input
          required
          min={0}
          max={730}
          step={1}
          type="number"
          id="template-dueOffsetDays"
          name="dueOffsetDays"
          defaultValue={template?.due_offset_days}
        />
        {state.errors?.dueOffsetDays ? <p className="text-sm text-destructive">{state.errors.dueOffsetDays}</p> : null}
      </div>

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

      <Button type="submit" disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? t("savePending") : template ? t("save") : t("add")}
      </Button>
    </form>
  );
}
