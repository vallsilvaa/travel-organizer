function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export type ExpenseReminderEmailInput = {
  appUrl: string;
  senderName: string;
  amount: string;
  tripDestination: string;
  tripId: string;
};

export function buildExpenseReminderEmail(input: ExpenseReminderEmailInput) {
  const senderName = escapeHtml(input.senderName);
  const destination = escapeHtml(input.tripDestination);
  const amount = escapeHtml(input.amount);
  const tripUrl = `${input.appUrl.replace(/\/$/, "")}/trips/${encodeURIComponent(input.tripId)}?tab=expenses`;

  return {
    subject: `${input.senderName} lembrou você de um saldo pendente em ${input.tripDestination}`,
    html: `
      <h1>Lembrete de saldo pendente</h1>
      <p><strong>Viagem:</strong> ${destination}</p>
      <p>${senderName} lembrou que você deve <strong>${amount}</strong> nesta viagem.</p>
      <p><a href="${tripUrl}">Abrir a aba Despesas</a></p>
      <p>Você pode desativar esses e-mails no seu painel do Travel Organizer.</p>
    `,
    text: [
      "Lembrete de saldo pendente",
      `Viagem: ${input.tripDestination}`,
      `${input.senderName} lembrou que você deve ${input.amount} nesta viagem.`,
      `Abrir a aba Despesas: ${tripUrl}`,
      "Você pode desativar esses e-mails no seu painel do Travel Organizer.",
    ].join("\n"),
  };
}
