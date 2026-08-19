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
