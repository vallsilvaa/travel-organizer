function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export type OverdueTaskEmailItem = {
  title: string;
  ownerName: string;
  dueDate: string;
  daysOverdue: number;
};

export type OverdueTasksEmailInput = {
  appUrl: string;
  tripDestination: string;
  tripId: string;
  tasks: OverdueTaskEmailItem[];
};

export function buildOverdueTasksEmail(input: OverdueTasksEmailInput) {
  const destination = escapeHtml(input.tripDestination);
  const tripUrl = `${input.appUrl.replace(/\/$/, "")}/trips/${encodeURIComponent(input.tripId)}?tab=preparation`;
  const count = input.tasks.length;

  const rows = input.tasks
    .map((task) => {
      const title = escapeHtml(task.title);
      const owner = escapeHtml(task.ownerName);
      const days = task.daysOverdue === 1 ? "1 dia" : `${task.daysOverdue} dias`;
      return `<li><strong>${title}</strong> — ${owner} — venceu em ${escapeHtml(task.dueDate)} (${days} atrasada)</li>`;
    })
    .join("\n");

  const textLines = input.tasks.map((task) => {
    const days = task.daysOverdue === 1 ? "1 dia" : `${task.daysOverdue} dias`;
    return `- ${task.title} — ${task.ownerName} — venceu em ${task.dueDate} (${days} atrasada)`;
  });

  return {
    subject: `${count} ${count === 1 ? "tarefa atrasada" : "tarefas atrasadas"} em ${input.tripDestination}`,
    html: `
      <h1>Tarefas atrasadas da viagem</h1>
      <p><strong>Viagem:</strong> ${destination}</p>
      <ul>${rows}</ul>
      <p><a href="${tripUrl}">Abrir a preparação da viagem</a></p>
      <p>Você pode desativar os e-mails de lembrete de tarefas no seu painel do Travel Organizer.</p>
    `,
    text: [
      "Tarefas atrasadas da viagem",
      `Viagem: ${input.tripDestination}`,
      ...textLines,
      `Abrir a preparação da viagem: ${tripUrl}`,
      "Você pode desativar os e-mails de lembrete de tarefas no seu painel do Travel Organizer.",
    ].join("\n"),
  };
}
