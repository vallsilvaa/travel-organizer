export type InvitationEmailInput = {
  appUrl: string;
  tripDestination: string;
  invitedByName: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildInvitationEmail(input: InvitationEmailInput) {
  const destination = escapeHtml(input.tripDestination);
  const invitedBy = escapeHtml(input.invitedByName);
  const dashboardUrl = `${input.appUrl.replace(/\/$/, "")}/dashboard`;

  return {
    subject: `Você foi convidado para organizar a viagem para ${input.tripDestination}`,
    html: `
      <h1>Convite para organizar uma viagem</h1>
      <p>${invitedBy} convidou você para ser organizador(a) da viagem para <strong>${destination}</strong> no Travel Organizer.</p>
      <p><a href="${dashboardUrl}">Entrar e ver o convite</a></p>
      <p>Se você não reconhece este convite, pode ignorar este e-mail com segurança.</p>
    `,
    text: [
      "Convite para organizar uma viagem",
      `${input.invitedByName} convidou você para ser organizador(a) da viagem para ${input.tripDestination} no Travel Organizer.`,
      `Entrar e ver o convite: ${dashboardUrl}`,
      "Se você não reconhece este convite, pode ignorar este e-mail com segurança.",
    ].join("\n"),
  };
}
