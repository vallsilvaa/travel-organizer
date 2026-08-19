/* Trip dates are calendar dates, so they are always read in UTC. */
function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function formatDate(
  value: string,
  dateStyle: "medium" | "long" = "long",
) {
  return new Intl.DateTimeFormat("en", { dateStyle, timeZone: "UTC" }).format(
    toUtcDate(value),
  );
}

export function formatDateRange(start: string, end: string | null) {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  const startLabel = new Intl.DateTimeFormat("en", options).format(
    toUtcDate(start),
  );

  if (!end) {
    return startLabel;
  }

  return `${startLabel} – ${new Intl.DateTimeFormat("en", options).format(toUtcDate(end))}`;
}

export function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "Time not defined";
}

export function formatMoney(amount: number | string, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

const MS_PER_DAY = 86_400_000;

/* Inclusive: Sep 10 → Sep 18 is 9 days. */
export function tripDuration(start: string, end: string | null) {
  if (!end) {
    return null;
  }

  const days =
    Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / MS_PER_DAY) + 1;

  return days > 0 ? days : null;
}

export function tripCountdown(start: string, end: string | null, today: string) {
  const now = toUtcDate(today).getTime();
  const startsAt = toUtcDate(start).getTime();
  const endsAt = end ? toUtcDate(end).getTime() : startsAt;

  if (now > endsAt) {
    return "Completed";
  }
  if (now >= startsAt) {
    return "Under way";
  }

  const days = Math.round((startsAt - now) / MS_PER_DAY);

  if (days === 0) {
    return "Departs today";
  }
  if (days === 1) {
    return "Departs tomorrow";
  }

  return `In ${days} days`;
}
