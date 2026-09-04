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
} from "@/features/prep-catalog/shared";

import { updatePrepTripItem, type PrepItemActionState } from "./actions";

type Participant = { user_id: string; display_name: string; role: string };
type ItineraryItemOption = { id: string; title: string };

type PrepItemFormProps = {
  itineraryItems: ItineraryItemOption[];
  participants: Participant[];
  task: {
    id: string;
    title: string;
    item_type: PrepItemType;
    category: TaskCategory;
    continent: Continent;
    country: string;
    city: string | null;
    classification: Classification;
    due_offset_days: number | null;
    currency: string | null;
    estimated_amount: string | null;
    paid_amount: string | null;
    document_instructions: string | null;
    owner_id: string | null;
    itinerary_item_id: string | null;
  };
  tripId: string;
};

const initialState: PrepItemActionState = {};

export function PrepItemForm({ itineraryItems, participants, task, tripId }: PrepItemFormProps) {
  const t = useTranslations("prepItemForm");
  const tPrepItemType = useTranslations("categories.prepItemType");
  const tClassification = useTranslations("categories.classification");
  const tContinent = useTranslations("categories.continent");
  const tCategory = useTranslations("categories.task");
  const prepItemTypeLabels = getPrepItemTypeLabels(tPrepItemType);
  const classificationLabels = getClassificationLabels(tClassification);
  const continentLabels = getContinentLabels(tContinent);
  const taskCategoryLabels = getTaskCategoryLabels(tCategory);

  const [state, formAction, pending] = useActionState(updatePrepTripItem, initialState);
  const [itemType, setItemType] = useState<PrepItemType>(task.item_type);

  useEffect(() => {
    if (state.success) {
      toast.success(t("toastUpdated"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="taskId" value={task.id} />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`prep-title-${task.id}`}>{t("titleLabel")}</Label>
        <Input
          required
          maxLength={200}
          id={`prep-title-${task.id}`}
          name="title"
          defaultValue={task.title}
        />
        {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-itemType-${task.id}`}>{t("itemTypeLabel")}</Label>
        <Select
          name="itemType"
          value={itemType}
          onValueChange={(value) => setItemType(value as PrepItemType)}
          items={prepItemTypeLabels}
        >
          <SelectTrigger id={`prep-itemType-${task.id}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prepItemTypes.map((type) => (
              <SelectItem key={type} value={type}>{prepItemTypeLabels[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-category-${task.id}`}>{t("categoryLabel")}</Label>
        <Select name="category" defaultValue={task.category} items={taskCategoryLabels}>
          <SelectTrigger id={`prep-category-${task.id}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {taskCategories.map((category) => (
              <SelectItem key={category} value={category}>{taskCategoryLabels[category]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-classification-${task.id}`}>{t("classificationLabel")}</Label>
        <Select name="classification" defaultValue={task.classification} items={classificationLabels}>
          <SelectTrigger id={`prep-classification-${task.id}`} className="w-full">
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
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-continent-${task.id}`}>{t("continentLabel")}</Label>
        <Select name="continent" defaultValue={task.continent} items={continentLabels}>
          <SelectTrigger id={`prep-continent-${task.id}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {continents.map((continent) => (
              <SelectItem key={continent} value={continent}>{continentLabels[continent]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-country-${task.id}`}>{t("countryLabel")}</Label>
        <Input required maxLength={100} id={`prep-country-${task.id}`} name="country" defaultValue={task.country} />
        {state.errors?.country ? <p className="text-sm text-destructive">{state.errors.country}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-city-${task.id}`}>
          {t("cityLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input maxLength={200} id={`prep-city-${task.id}`} name="city" defaultValue={task.city ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-dueOffsetDays-${task.id}`}>{t("dueOffsetDaysLabel")}</Label>
        <Input
          required
          min={0}
          max={730}
          step={1}
          type="number"
          id={`prep-dueOffsetDays-${task.id}`}
          name="dueOffsetDays"
          defaultValue={task.due_offset_days ?? 0}
        />
        {state.errors?.dueOffsetDays ? <p className="text-sm text-destructive">{state.errors.dueOffsetDays}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-assignedTo-${task.id}`}>
          {t("assignedToLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Select
          name="assignedTo"
          defaultValue={task.owner_id ?? "none"}
          items={{
            none: t("assignedToNone"),
            ...Object.fromEntries(participants.map((p) => [p.user_id, `${p.display_name} (${p.role})`])),
          }}
        >
          <SelectTrigger id={`prep-assignedTo-${task.id}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("assignedToNone")}</SelectItem>
            {participants.map((participant) => (
              <SelectItem key={participant.user_id} value={participant.user_id}>
                {participant.display_name} ({participant.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-itineraryItemId-${task.id}`}>
          {t("itineraryLinkLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Select
          name="itineraryItemId"
          defaultValue={task.itinerary_item_id ?? "none"}
          items={{
            none: t("itineraryLinkNone"),
            ...Object.fromEntries(itineraryItems.map((item) => [item.id, item.title])),
          }}
        >
          <SelectTrigger id={`prep-itineraryItemId-${task.id}`} className="w-full">
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

      <div className="space-y-2">
        <Label htmlFor={`prep-currency-${task.id}`}>
          {t("currencyLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          minLength={3}
          maxLength={3}
          id={`prep-currency-${task.id}`}
          name="currency"
          defaultValue={task.currency ?? ""}
          placeholder="BRL"
          className="uppercase"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-estimatedAmount-${task.id}`}>
          {t("estimatedAmountLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          min="0"
          step="0.01"
          type="number"
          inputMode="decimal"
          id={`prep-estimatedAmount-${task.id}`}
          name="estimatedAmount"
          defaultValue={task.estimated_amount ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`prep-paidAmount-${task.id}`}>
          {t("paidAmountLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </Label>
        <Input
          min="0"
          step="0.01"
          type="number"
          inputMode="decimal"
          id={`prep-paidAmount-${task.id}`}
          name="paidAmount"
          defaultValue={task.paid_amount ?? ""}
        />
      </div>

      {itemType === "document_request" ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`prep-documentInstructions-${task.id}`}>{t("documentInstructionsLabel")}</Label>
          <Textarea
            maxLength={2000}
            id={`prep-documentInstructions-${task.id}`}
            name="documentInstructions"
            defaultValue={task.document_instructions ?? ""}
          />
          {state.errors?.documentInstructions ? (
            <p className="text-sm text-destructive">{state.errors.documentInstructions}</p>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground sm:col-span-2">{t("costsHint")}</p>

      <Button type="submit" disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? t("savePending") : t("save")}
      </Button>
    </form>
  );
}
