import { todayInTimeZone } from "./timezone";

export type TripStatus = "upcoming" | "active" | "completed" | "archived";

export type TripStatusInput = {
  start_date: string;
  end_date: string | null;
  archived_at: string | null;
  timezone: string;
};

/** A trip's lifecycle stage - "futura" (upcoming), "acontecendo" (active),
 * "concluída" (completed), or "arquivada" (archived) - computed from its
 * dates rather than stored, so it's always consistent with start/end date
 * edits. Archived always wins regardless of dates (see #171's archive
 * semantics: frozen, not un-datable). New participants can only be invited
 * while a trip is "upcoming" - see features/invitations/actions.ts. */
export function tripStatus(trip: TripStatusInput): TripStatus {
  if (trip.archived_at) {
    return "archived";
  }
  const today = todayInTimeZone(trip.timezone);
  const endDate = trip.end_date ?? trip.start_date;
  if (today < trip.start_date) {
    return "upcoming";
  }
  if (today > endDate) {
    return "completed";
  }
  return "active";
}
