import type { getTranslations } from "next-intl/server";

import type { Classification, Continent, PrepItemType } from "@/features/prep-catalog/shared";
import { AddTaskFromCatalogModal } from "@/features/prep-catalog/add-task-from-catalog-modal";
import type { TaskCategory } from "@/features/tasks/templates";
import { buttonVariants } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  isArchived: boolean;
  hasItems: boolean;
  itineraryTemplates: CatalogTemplate[];
  appliedTemplateIds: string[];
  taskCategoryLabels: Record<TaskCategory, string>;
  prepItemTypeLabels: Record<PrepItemType, string>;
  classificationLabels: Record<Classification, string>;
  continentLabels: Record<Continent, string>;
  t: Translator;
};

export function ItineraryHeader({
  tripId,
  isArchived,
  hasItems,
  itineraryTemplates,
  appliedTemplateIds,
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
            // Only "reuse from catalog" lives here - a saved template has no
            // time/period/address/notes to give a new item, so a "create new
            // catalog item" entry point here would always cap a brand-new
            // itinerary item at those 4 fields. Adding one with full detail
            // (not tied to any reusable template) is the "Adicionar item ao
            // roteiro" panel below, via the full ItineraryForm.
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
          {hasItems ? (
            <a
              href={`/api/trips/${tripId}/itinerary.ics`}
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("itinerary.exportIcs")}
            </a>
          ) : null}
        </div>
      </div>
    </CardHeader>
  );
}
