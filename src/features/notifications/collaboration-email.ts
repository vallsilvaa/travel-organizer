export type CollaborationAction = "created" | "updated" | "deleted";

export type CollaborationEntityType =
  | "itinerary_item"
  | "reservation"
  | "trip_task"
  | "trip_expense"
  | "item_comment";

const entityLabels: Record<CollaborationEntityType, string> = {
  itinerary_item: "um item do itinerário",
  reservation: "uma reserva",
  trip_task: "um item de preparação",
  trip_expense: "uma despesa",
  item_comment: "um comentário",
};

const actionVerbs: Record<CollaborationAction, string> = {
  created: "adicionou",
  updated: "atualizou",
  deleted: "removeu",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export type CollaborationNotificationCopy = {
  title: string;
  body: string;
};

export function buildCollaborationNotificationCopy(input: {
  actorName: string;
  entityType: CollaborationEntityType;
  action: CollaborationAction;
  itemLabel: string;
}): CollaborationNotificationCopy {
  const entity = entityLabels[input.entityType];
  const verb = actionVerbs[input.action];

  return {
    title: `${input.actorName} ${verb} ${entity}`.slice(0, 200),
    body: input.itemLabel.slice(0, 500),
  };
}

export type CollaborationEmailInput = {
  appUrl: string;
  actorName: string;
  entityType: CollaborationEntityType;
  action: CollaborationAction;
  itemLabel: string;
  tripDestination: string;
  tripId: string;
  tab: string;
  occurredAt: Date;
};

export function buildCollaborationEmail(input: CollaborationEmailInput) {
  const actorName = escapeHtml(input.actorName);
  const destination = escapeHtml(input.tripDestination);
  const itemLabel = escapeHtml(input.itemLabel);
  const entity = entityLabels[input.entityType];
  const verb = actionVerbs[input.action];
  const tripUrl = `${input.appUrl.replace(/\/$/, "")}/trips/${encodeURIComponent(input.tripId)}?tab=${encodeURIComponent(input.tab)}`;
  const when = input.occurredAt.toLocaleString("pt-BR", { timeZone: "UTC" });

  return {
    subject: `${input.actorName} ${verb} ${entity} em ${input.tripDestination}`,
    html: `
      <h1>Atualização na viagem</h1>
      <p><strong>Viagem:</strong> ${destination}</p>
      <p><strong>Quem:</strong> ${actorName}</p>
      <p><strong>O que:</strong> ${verb} ${entity} - ${itemLabel}</p>
      <p><strong>Quando:</strong> ${when} (UTC)</p>
      <p><a href="${tripUrl}">Abrir a viagem</a></p>
      <p>Você pode desativar essas notificações por e-mail no seu painel do Travel Organizer.</p>
    `,
    text: [
      "Atualização na viagem",
      `Viagem: ${input.tripDestination}`,
      `Quem: ${input.actorName}`,
      `O que: ${verb} ${entity} - ${input.itemLabel}`,
      `Quando: ${when} (UTC)`,
      `Abrir a viagem: ${tripUrl}`,
      "Você pode desativar essas notificações por e-mail no seu painel do Travel Organizer.",
    ].join("\n"),
  };
}
