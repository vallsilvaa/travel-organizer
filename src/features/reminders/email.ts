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

export function getReminderWindow(now = new Date()) {
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 3);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function buildReminderEmail(input: ReminderEmailInput) {
  const destination = escapeHtml(input.tripDestination);
  const task = escapeHtml(input.taskTitle);
  const deadline = escapeHtml(input.deadline);
  const tripUrl = `${input.appUrl.replace(/\/$/, "")}/trips/${encodeURIComponent(input.tripId)}`;

  return {
    subject: `Upcoming task for ${input.tripDestination}`,
    html: `
      <h1>Trip task reminder</h1>
      <p><strong>Trip:</strong> ${destination}</p>
      <p><strong>Task:</strong> ${task}</p>
      <p><strong>Deadline:</strong> ${deadline}</p>
      <p><a href="${tripUrl}">Open the trip</a></p>
      <p>You can disable task reminder emails from your Travel Organizer dashboard.</p>
    `,
    text: [
      "Trip task reminder",
      `Trip: ${input.tripDestination}`,
      `Task: ${input.taskTitle}`,
      `Deadline: ${input.deadline}`,
      `Open the trip: ${tripUrl}`,
      "You can disable task reminder emails from your Travel Organizer dashboard.",
    ].join("\n"),
  };
}
