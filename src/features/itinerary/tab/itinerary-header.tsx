import type { getTranslations } from "next-intl/server";

import type { Classification, Continent, PrepItemType } from "@/features/prep-catalog/shared";
import { ItineraryCatalogModal } from "@/features/itinerary/itinerary-catalog-modal";
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
  location: string | null;
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
  activitySuggestions: string[];
  // R06 (#233): the catalog modal's per-item date step constrains each date
  // input to the trip's own range, the same start_date/end_date bounds R04's
  // single-item form already validates against server-side.
  tripStartDate: string;
  tripEndDate: string;
  t: Translator;
};

export function ItineraryHeader({
  tripId,
  tripTitle,
  isArchived,
  hasItems,
  itineraryTemplates,
  activitySuggestions,
  tripStartDate,
  tripEndDate,
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
            // R05 (#232): purpose-built single-select search, replacing
            // AddTaskFromCatalogModal here - that shared modal still bulk-
            // applies templates straight onto the trip's start_date without
            // asking, which is wrong for itinerary items (the date matters).
            // It's untouched and still used as-is by the Preparação tab.
            <ItineraryCatalogModal
              tripId={tripId}
              templates={itineraryTemplates}
              activitySuggestions={activitySuggestions}
              triggerLabel={t("itinerary.addFromCatalog")}
              tripStartDate={tripStartDate}
              tripEndDate={tripEndDate}
            />
          ) : null}
          {hasItems ? <ItineraryExportMenu tripId={tripId} tripTitle={tripTitle} /> : null}
        </div>
      </div>
    </CardHeader>
  );
}
