import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { buildItineraryIcs } from "@/features/itinerary/ics";
import { getItineraryPeriodLabels, isItineraryPeriod } from "@/features/itinerary/validation";
import { isValidTripId } from "@/features/trips/validation";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
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
    .select("id, destination, timezone")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("itinerary_items")
    .select("id, item_date, start_time, title, location, notes, period")
    .eq("trip_id", tripId)
    .order("item_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false });

  if (itemsError) {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }

  const periodLabels = getItineraryPeriodLabels(await getTranslations("categories.itineraryPeriod"));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const ics = buildItineraryIcs({
    tripDestination: trip.destination,
    tripTimezone: trip.timezone,
    tripUrl: `${appUrl.replace(/\/$/, "")}/trips/${trip.id}`,
    items: (items ?? []).map((item) => ({
      ...item,
      periodLabel: item.period && isItineraryPeriod(item.period) ? periodLabels[item.period] : null,
    })),
  });

  const fileName = `${trip.destination.replace(/[^a-zA-Z0-9]+/g, "-") || "viagem"}-itinerario.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
