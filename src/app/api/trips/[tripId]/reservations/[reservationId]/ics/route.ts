import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { buildReservationIcs } from "@/features/itinerary/ics";
import { getReservationTypeLabels, isValidReservationId, type ReservationType } from "@/features/reservations/validation";
import { isValidTripId } from "@/features/trips/validation";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string; reservationId: string }> },
) {
  const { tripId, reservationId } = await params;

  if (!isValidTripId(tripId) || !isValidReservationId(reservationId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
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

  const { data: reservation, error: reservationError } = await supabase
    .from("trip_reservations")
    .select(
      "id, reservation_type, title, confirmation_code, start_date, start_time, end_date, end_time, location, destination_location, notes",
    )
    .eq("id", reservationId)
    .eq("trip_id", tripId)
    .single();

  if (reservationError || !reservation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const reservationTypeLabels = getReservationTypeLabels(await getTranslations("categories.reservationType"));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const tripUrl = `${appUrl.replace(/\/$/, "")}/trips/${trip.id}?tab=itinerary#reservation-${reservation.id}`;

  const ics = buildReservationIcs({
    tripDestination: trip.destination,
    tripTimezone: trip.timezone,
    tripUrl,
    reservation: {
      id: reservation.id,
      title: reservation.title,
      reservationTypeLabel: reservationTypeLabels[reservation.reservation_type as ReservationType] ?? null,
      startDate: reservation.start_date,
      startTime: reservation.start_time,
      endDate: reservation.end_date,
      endTime: reservation.end_time,
      location: reservation.location,
      destinationLocation: reservation.destination_location,
      notes: reservation.notes,
      confirmationCode: reservation.confirmation_code,
    },
  });

  const fileName = `${reservation.title.replace(/[^a-zA-Z0-9]+/g, "-") || "reserva"}.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
