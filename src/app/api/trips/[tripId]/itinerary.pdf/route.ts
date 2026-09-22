import { NextResponse } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { groupItineraryItemsByDay, sortItineraryItems } from "@/features/itinerary/tab/grouping";
import { asciiPdfFileName, pdfFileName } from "@/features/itinerary/pdf-filename";
import { buildItineraryPdfDocument, type ItineraryPdfDay } from "@/features/itinerary/pdf";
import { getItineraryPeriodLabels, isItineraryPeriod } from "@/features/itinerary/validation";
import { isValidTripId } from "@/features/trips/validation";
import { createClient } from "@/lib/supabase/server";

// Mirrors itinerary-tab.tsx's capitalize() (#243/R08): Intl's `weekday: "long"`
// formats pt-BR weekday names lowercase ("terça-feira"), so the day heading
// capitalizes it explicitly to match the UI's day-tab heading exactly.
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;

  if (!isValidTripId(tripId)) {
    return NextResponse.json({ error: "invalid_trip" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, title, start_date, end_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("itinerary_items")
    .select("id, item_date, start_time, end_time, title, location, notes, period, city, approx_distance")
    .eq("trip_id", tripId)
    .order("item_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false });

  if (itemsError) {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }

  const { data: reservations } = await supabase
    .from("reservations")
    .select("title, itinerary_item_id")
    .eq("trip_id", tripId);

  const reservationTitlesByItemId = new Map<string, string[]>();
  for (const reservation of reservations ?? []) {
    if (!reservation.itinerary_item_id) {
      continue;
    }
    const titles = reservationTitlesByItemId.get(reservation.itinerary_item_id) ?? [];
    titles.push(reservation.title);
    reservationTitlesByItemId.set(reservation.itinerary_item_id, titles);
  }

  const [t, tForm, tPdf, format] = await Promise.all([
    getTranslations("trip"),
    getTranslations("itineraryForm"),
    getTranslations("itineraryPdf"),
    getFormatter(),
  ]);
  const periodLabels = getItineraryPeriodLabels(await getTranslations("categories.itineraryPeriod"));
  const formatDate = (value: string) => format.dateTime(new Date(`${value}T00:00:00Z`), "long");
  const formatWeekday = (value: string) => format.dateTime(new Date(`${value}T00:00:00Z`), "weekday");

  const startDate = trip.start_date;
  const lastDay = trip.end_date ?? trip.start_date;
  const sortedItems = sortItineraryItems(items ?? []);
  const dayGroups = groupItineraryItemsByDay(sortedItems, startDate, lastDay);

  const days: ItineraryPdfDay[] = dayGroups.map((group) => ({
    heading: t("itinerary.dayHeading", {
      day: group.dayNumber,
      weekday: capitalize(formatWeekday(group.date)),
      date: formatDate(group.date),
    }),
    items: group.items.map((item) => ({
      id: item.id,
      title: item.title,
      timeRangeLabel: item.start_time
        ? `${item.start_time.slice(0, 5)}${item.end_time ? `–${item.end_time.slice(0, 5)}` : ""}`
        : null,
      periodLabel: item.period && isItineraryPeriod(item.period) ? periodLabels[item.period] : null,
      location: item.location,
      city: item.city,
      approxDistance: item.approx_distance,
      notes: item.notes,
      linkedReservationTitles: reservationTitlesByItemId.get(item.id) ?? [],
    })),
  }));

  const document = buildItineraryPdfDocument({
    tripTitle: trip.title,
    tripDateRangeLabel:
      startDate === lastDay ? formatDate(startDate) : `${formatDate(startDate)} – ${formatDate(lastDay)}`,
    days,
    labels: {
      timeLabel: tForm("timeLabel"),
      periodLabel: tForm("periodLabel"),
      locationLabel: tForm("locationLabel"),
      cityLabel: tForm("cityLabel"),
      approxDistanceLabel: tForm("approxDistanceLabel"),
      notesLabel: tForm("notesLabel"),
      linkedReservationsLabel: tPdf("linkedReservationsLabel"),
      emptyDayLabel: t("itinerary.emptyDay"),
    },
  });

  const pdfBuffer = await renderToBuffer(document);
  const asciiName = asciiPdfFileName(trip.title).replace(/"/g, "");
  const utf8Name = pdfFileName(trip.title);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
    },
  });
}
