import type { getTranslations } from "next-intl/server";

import type { Classification, Continent, PrepItemType } from "@/features/prep-catalog/shared";
import { AddTaskFromCatalogModal } from "@/features/prep-catalog/add-task-from-catalog-modal";
import { NewItineraryItemModal } from "@/features/itinerary/new-item-modal";
import type { TaskCategory } from "@/features/tasks/templates";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ItineraryExportMenu } from "./export-menu";

type Translator = Awaited<ReturnType<typeof getTranslations<"trip">>>;

export type CatalogTemplate = {
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

type ItineraryHeaderProps = {
  tripId: string;
  tripTitle: string;
  isArchived: boolean;
  hasItems: boolean;
  itineraryTemplates: CatalogTemplate[];
  appliedTemplateIds: string[];
  activitySuggestions: string[];
  taskCategoryLabels: Record<TaskCategory, string>;
  prepItemTypeLabels: Record<PrepItemType, string>;
  classificationLabels: Record<Classification, string>;
  continentLabels: Record<Continent, string>;
  t: Translator;
};

export function ItineraryHeader({
  tripId,
  tripTitle,
  isArchived,
  hasItems,
  itineraryTemplates,
  appliedTemplateIds,
  activitySuggestions,
  taskCategoryLabels,
  prepItemTypeLabels,
  classificationLabels,
  continentLabels,
  t,
}: ItineraryHeaderProps) {
  return (
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-2xl">{t("itinerary.title")}</CardTitle>
          <CardDescription>
            {t("itinerary.description")}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isArchived ? (
            // Full detail (time/period/address/notes, not capped to what a
            // saved template carries) - this is the only "add" entry point
            // now (#231/R04 replaces the old inline CollapsibleFormPanel
            // with an always-a-modal flow); "reuse from catalog" is the
            // narrower, template-only complement next to it.
            <NewItineraryItemModal
              tripId={tripId}
              activitySuggestions={activitySuggestions}
              triggerLabel={t("itinerary.addItem")}
            />
          ) : null}
          {!isArchived ? (
            <AddTaskFromCatalogModal
              templates={itineraryTemplates}
              tripId={tripId}
              taskCategoryLabels={taskCategoryLabels}
              prepItemTypeLabels={prepItemTypeLabels}
              classificationLabels={classificationLabels}
              continentLabels={continentLabels}
              appliedTemplateIds={appliedTemplateIds}
              triggerLabel={t("itinerary.addFromCatalog")}
              title={t("itinerary.catalogModalTitle")}
              description={t("itinerary.catalogModalDescription")}
              noTemplatesMessage={t("itinerary.catalogModalNoTemplates")}
              toastMessage={t("itinerary.catalogModalToast")}
            />
          ) : null}
          {hasItems ? <ItineraryExportMenu tripId={tripId} tripTitle={tripTitle} /> : null}
        </div>
      </div>
    </CardHeader>
  );
}
