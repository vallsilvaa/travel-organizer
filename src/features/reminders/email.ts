import { todayInTimeZone } from "@/lib/timezone";

export type ReminderEmailInput = {
  appUrl: string;
  deadline: string;
  taskTitle: string;
  tripDestination: string;
  tripId: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** A coarse UTC pre-filter for the SQL query: 1 day of slack on each side of
 * the plain 3-day window, wide enough to cover every IANA offset (UTC-12 to
 * UTC+14) before {@link isWithinReminderWindow} narrows it per trip. */
export function getReminderWindow(now = new Date()) {
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 5);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** The precise, per-trip check: is `dueDate` within the next 3 days as
 * observed in the trip's own timezone (issue #40), rather than the server's
 * UTC clock. */
export function isWithinReminderWindow(dueDate: string, timezone: string, now = new Date()) {
  const start = todayInTimeZone(timezone, now);
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 3);

  return dueDate >= start && dueDate <= end.toISOString().slice(0, 10);
}

export function buildReminderEmail(input: ReminderEmailInput) {
  const destination = escapeHtml(input.tripDestination);
  const task = escapeHtml(input.taskTitle);
  const deadline = escapeHtml(input.deadline);
  const tripUrl = `${input.appUrl.replace(/\/$/, "")}/trips/${encodeURIComponent(input.tripId)}`;

  return {
    subject: `Tarefa pendente para ${input.tripDestination}`,
    html: `
      <h1>Lembrete de tarefa da viagem</h1>
      <p><strong>Viagem:</strong> ${destination}</p>
      <p><strong>Tarefa:</strong> ${task}</p>
      <p><strong>Prazo:</strong> ${deadline}</p>
      <p><a href="${tripUrl}">Abrir a viagem</a></p>
      <p>Você pode desativar os e-mails de lembrete de tarefas no seu painel do Travel Organizer.</p>
    `,
    text: [
      "Lembrete de tarefa da viagem",
      `Viagem: ${input.tripDestination}`,
      `Tarefa: ${input.taskTitle}`,
      `Prazo: ${input.deadline}`,
      `Abrir a viagem: ${tripUrl}`,
      "Você pode desativar os e-mails de lembrete de tarefas no seu painel do Travel Organizer.",
    ].join("\n"),
  };
}
