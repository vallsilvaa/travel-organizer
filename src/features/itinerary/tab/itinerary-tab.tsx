import type { getTranslations } from "next-intl/server";

import type { ItemComment } from "@/features/comments/comment-thread";
import { deleteItineraryItem } from "@/features/itinerary/actions";
import { ItineraryForm } from "@/features/itinerary/itinerary-form";
import { itineraryPeriods } from "@/features/itinerary/validation";
import { ItemActionsMenu } from "@/components/item-actions-menu";
import { Card, CardContent } from "@/components/ui/card";

import { ActiveDayProvider } from "./active-day-context";
import { ItineraryFilters } from "./filters";
import {
  defaultItineraryDay,
  filterItineraryItems,
  groupItineraryItemsByDay,
  outOfRangeItineraryItems,
  sortItineraryItems,
  tripCitiesForFilter,
  type ItineraryDayGroup,
  type TripDestinationForFilter,
} from "./grouping";
import { ItineraryHeader, type CatalogTemplate } from "./itinerary-header";
import { ItineraryItemCard, type ItineraryItem } from "./item-card";
import { ItinerarySchedule } from "./itinerary-schedule";

type Translator = Awaited<ReturnType<typeof getTranslations<"trip">>>;
type ItineraryPeriod = (typeof itineraryPeriods)[number];

// Intl's `weekday: "long"` formats pt-BR weekday names lowercase ("terça-feira"),
// unlike en-US ("Tuesday") - the day heading always wants it capitalized, so this
// normalizes both instead of hand-rolling per-locale casing rules.
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type LinkedReservation = { id: string; title: string };
type LinkedTask = { id: string; title: string; completed_at: string | null };

type ItineraryTabProps = {
  tripId: string;
  tripTitle: string;
  isArchived: boolean;
  currentUserId: string;
  itineraryItems: ItineraryItem[];
  itineraryError: boolean;
  activitySuggestions: string[];
  reservationsByItineraryItemId: Map<string, LinkedReservation[]>;
  tasksByItineraryItemId: Map<string, LinkedTask[]>;
  commentsFor: (itemType: "itinerary" | "task", itemId: string) => ItemComment[];
  participantNames: Map<string, string>;
  catalogTemplates: CatalogTemplate[];
  itineraryPeriodLabels: Record<ItineraryPeriod, string>;
  tripDestinations: TripDestinationForFilter[];
  cityFilter: string;
  itineraryPeriodFilter: ItineraryPeriod | "all";
  tripStartDate: string;
  tripLastDay: string;
  today: string;
  t: Translator;
  formatDate: (value: string) => string;
  formatWeekday: (value: string) => string;
  formatItineraryWhen: (item: {
    item_date: string;
    start_time: string | null;
    end_time: string | null;
    period: string | null;
  }) => string;
};

export function ItineraryTab({
  tripId,
  tripTitle,
  isArchived,
  currentUserId,
  itineraryItems,
  itineraryError,
  activitySuggestions,
  reservationsByItineraryItemId,
  tasksByItineraryItemId,
  commentsFor,
  participantNames,
  catalogTemplates,
  itineraryPeriodLabels,
  tripDestinations,
  cityFilter,
  itineraryPeriodFilter,
  tripStartDate,
  tripLastDay,
  today,
  t,
  formatDate,
  formatWeekday,
  formatItineraryWhen,
}: ItineraryTabProps) {
  const hasItems = itineraryItems.length > 0;
  const sortedItineraryItems = sortItineraryItems(itineraryItems);
  const tripCities = tripCitiesForFilter(tripDestinations, sortedItineraryItems);
  const filteredItineraryItems = filterItineraryItems(sortedItineraryItems, {
    city: cityFilter,
    period: itineraryPeriodFilter,
  });
  const itineraryDayGroups = groupItineraryItemsByDay(filteredItineraryItems, tripStartDate, tripLastDay);
  const defaultDay = defaultItineraryDay(itineraryDayGroups);
  const outOfRangeItems = outOfRangeItineraryItems(filteredItineraryItems, tripStartDate, tripLastDay);
  // A filter active means the day-tab navigation (one day at a time) gives
  // way to a single chronological list across the whole trip (R09) - days
  // with nothing left after filtering are skipped instead of showing an
  // "empty day" placeholder for every day the filter ruled out.
  const hasActiveFilters = cityFilter !== "all" || itineraryPeriodFilter !== "all";
  const nonEmptyDayGroups = itineraryDayGroups.filter((group) => group.items.length > 0);

  function renderDaySection(group: ItineraryDayGroup<ItineraryItem>) {
    return (
      <section key={group.date}>
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t("itinerary.dayHeading", {
            day: group.dayNumber,
            weekday: capitalize(formatWeekday(group.date)),
            date: formatDate(group.date),
          })}
        </h3>
        {group.items.length ? (
          <ol className="mt-3 space-y-4">
            {group.items.map((item) => (
              <ItineraryItemCard
                key={item.id}
                item={item}
                tripId={tripId}
                isArchived={isArchived}
                activitySuggestions={activitySuggestions}
                whenLabel={formatItineraryWhen(item)}
                linkedReservations={reservationsByItineraryItemId.get(item.id) ?? []}
                linkedTasks={tasksByItineraryItemId.get(item.id) ?? []}
                comments={commentsFor("itinerary", item.id)}
                currentUserId={currentUserId}
                participantNames={participantNames}
                t={t}
              />
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">{t("itinerary.emptyDay")}</p>
        )}
      </section>
    );
  }

  return (
    <ActiveDayProvider defaultDay={defaultDay ?? tripStartDate}>
      <Card className="[--card-spacing:--spacing(6)]">
        <ItineraryHeader
          tripId={tripId}
          tripTitle={tripTitle}
          isArchived={isArchived}
          hasItems={hasItems}
          itineraryTemplates={catalogTemplates.filter((template) => template.item_type === "itinerary_item")}
          activitySuggestions={activitySuggestions}
          t={t}
        />
        <CardContent>
          <ItineraryFilters
            cities={tripCities}
            cityFilter={cityFilter}
            periodFilter={itineraryPeriodFilter}
            periodLabels={itineraryPeriodLabels}
            cityFilterLabel={t("itinerary.cityFilterLabel")}
            cityFilterAllLabel={t("itinerary.cityFilterAll")}
            periodFilterLabel={t("itinerary.periodFilterLabel")}
            periodFilterAllLabel={t("itinerary.periodFilterAll")}
            applyFiltersLabel={t("itinerary.applyFilters")}
            clearFiltersLabel={t("itinerary.clearFilters")}
          />

          {itineraryError ? (
            <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              {t("itinerary.loadError")}
            </p>
          ) : filteredItineraryItems.length ? (
            <>
              {outOfRangeItems.length ? (
                <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
                  <h3 className="font-semibold text-amber-900">{t("itinerary.outOfRangeTitle")}</h3>
                  <p className="mt-1 text-sm text-amber-800">{t("itinerary.outOfRangeDescription")}</p>
                  <ul className="mt-3 space-y-2">
                    {outOfRangeItems.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
                        <span>{formatDate(item.item_date)} · {item.title}</span>
                        <ItemActionsMenu
                          editLabel={t("itinerary.editItem")}
                          editForm={<ItineraryForm item={item} tripId={tripId} activitySuggestions={activitySuggestions} />}
                          deleteAction={deleteItineraryItem}
                          deleteHiddenFields={{ tripId, itemId: item.id }}
                          deleteTitle={t("itinerary.deleteItemTitle")}
                          deleteDescription={t("itinerary.deleteItemDescription", { title: item.title })}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hasActiveFilters ? (
                <div className="mt-6 space-y-6">{nonEmptyDayGroups.map((group) => renderDaySection(group))}</div>
              ) : (
                <ItinerarySchedule
                  tripStartDate={tripStartDate}
                  tripLastDay={tripLastDay}
                  today={today}
                  defaultDay={defaultDay ?? tripStartDate}
                  datesWithItems={itineraryDayGroups.filter((group) => group.items.length > 0).map((group) => group.date)}
                  days={itineraryDayGroups.map((group) => ({
                    date: group.date,
                    label: t("itinerary.dayTabLabel", { day: group.dayNumber }),
                    content: renderDaySection(group),
                  }))}
                />
              )}
            </>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              {hasItems ? t("itinerary.noneMatchFilters") : t("itinerary.empty")}
            </p>
          )}
        </CardContent>
      </Card>
    </ActiveDayProvider>
  );
}
