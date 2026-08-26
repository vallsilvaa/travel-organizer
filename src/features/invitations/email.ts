export type InvitationEmailInput = {
  appUrl: string;
  tripDestination: string;
  invitedByName: string;
  role: "traveler" | "organizer";
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
  const roleNoun = input.role === "organizer" ? "organizador(a)" : "viajante";
  const subjectAction = input.role === "organizer"
    ? `organizar a viagem para ${input.tripDestination}`
    : `viajar para ${input.tripDestination}`;

  return {
    subject: `Você foi convidado para ${subjectAction}`,
    html: `
      <h1>Convite para uma viagem</h1>
      <p>${invitedBy} convidou você para ser ${roleNoun} da viagem para <strong>${destination}</strong> no Travel Organizer.</p>
      <p><a href="${dashboardUrl}">Entrar e ver o convite</a></p>
      <p>Se você não reconhece este convite, pode ignorar este e-mail com segurança.</p>
    `,
    text: [
      "Convite para uma viagem",
      `${input.invitedByName} convidou você para ser ${roleNoun} da viagem para ${input.tripDestination} no Travel Organizer.`,
      `Entrar e ver o convite: ${dashboardUrl}`,
      "Se você não reconhece este convite, pode ignorar este e-mail com segurança.",
    ].join("\n"),
  };
}
