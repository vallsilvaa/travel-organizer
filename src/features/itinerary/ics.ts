export type IcsItineraryItem = {
  id: string;
  item_date: string;
  start_time: string | null;
  title: string;
  location: string | null;
  notes: string | null;
};

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** RFC 5545 requires content lines to be folded at 75 octets, continued by
 * a CRLF followed by a single space. */
function foldLine(line: string) {
  if (line.length <= 75) {
    return line;
  }

  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = rest.slice(74);
  }
  chunks.push(rest);
  return chunks.join("\r\n ");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateStampUtcNow() {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

function compactDate(isoDate: string) {
  return isoDate.replaceAll("-", "");
}

/** Pure UTC date-only arithmetic, so this never depends on the server's
 * local timezone. */
function addOneDayCompact(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function timedEventBounds(itemDate: string, startTime: string) {
  const [hourText, minuteText] = startTime.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  const startStamp = `${compactDate(itemDate)}T${pad(hour)}${pad(minute)}00`;

  const totalEndMinutes = hour * 60 + minute + 60;
  const rolledOver = totalEndMinutes >= 24 * 60;
  const endHour = Math.floor(totalEndMinutes / 60) % 24;
  const endMinute = totalEndMinutes % 60;
  const endDateCompact = rolledOver ? addOneDayCompact(itemDate) : compactDate(itemDate);
  const endStamp = `${endDateCompact}T${pad(endHour)}${pad(endMinute)}00`;

  return { startStamp, endStamp };
}

export function buildItineraryIcs(input: {
  tripDestination: string;
  tripTimezone: string;
  tripUrl: string;
  items: IcsItineraryItem[];
}) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Travel Organizer//Itinerary Export//PT",
    "CALSCALE:GREGORIAN",
  ];

  for (const item of input.items) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.id}@travel-organizer`);
    lines.push(`DTSTAMP:${dateStampUtcNow()}`);

    if (item.start_time) {
      const { startStamp, endStamp } = timedEventBounds(item.item_date, item.start_time);
      // Named TZID instead of a floating time: every mainstream calendar
      // app (Google, Apple, Outlook) resolves well-known IANA identifiers
      // without requiring an embedded VTIMEZONE block.
      lines.push(`DTSTART;TZID=${input.tripTimezone}:${startStamp}`);
      lines.push(`DTEND;TZID=${input.tripTimezone}:${endStamp}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(item.item_date)}`);
      lines.push(`DTEND;VALUE=DATE:${addOneDayCompact(item.item_date)}`);
    }

    lines.push(foldLine(`SUMMARY:${escapeIcsText(item.title)}`));
    if (item.location) {
      lines.push(foldLine(`LOCATION:${escapeIcsText(item.location)}`));
    }

    const descriptionParts = [
      item.notes ? escapeIcsText(item.notes) : null,
      `Viagem: ${escapeIcsText(input.tripDestination)}`,
      input.tripUrl,
    ].filter((part): part is string => Boolean(part));
    lines.push(foldLine(`DESCRIPTION:${descriptionParts.join("\\n")}`));
    lines.push(foldLine(`URL:${input.tripUrl}`));

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
