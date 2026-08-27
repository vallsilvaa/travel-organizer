export const taskCategories = [
  "documents",
  "lodging",
  "money",
  "transport",
  "health",
  "connectivity",
  "experiences",
  "packing",
  "other",
] as const;

export type TaskCategory = (typeof taskCategories)[number];

// Built from a translator scoped to the "categories.task" namespace at each
// call site (server or client) rather than a hardcoded record, since this
// module has no access to the render-time locale on its own.
export function getTaskCategoryLabels(t: (category: TaskCategory) => string): Record<TaskCategory, string> {
  return Object.fromEntries(taskCategories.map((category) => [category, t(category)])) as Record<TaskCategory, string>;
}

type PreparationTemplateItem = {
  category: TaskCategory;
  critical?: boolean;
  daysBefore: 180 | 120 | 90 | 30 | 7 | 1;
  key: string;
  title: string;
};

export const englandPreparationTemplate: PreparationTemplateItem[] = [
  { key: "passport", title: "Verificar a validade do passaporte", category: "documents", daysBefore: 180, critical: true },
  { key: "eta", title: "Solicitar o ETA do Reino Unido", category: "documents", daysBefore: 180, critical: true },
  { key: "lodging-research", title: "Pesquisar opções de hospedagem reembolsáveis", category: "lodging", daysBefore: 180 },
  { key: "daily-budget", title: "Planejar o orçamento diário da viagem", category: "money", daysBefore: 180 },
  { key: "travel-card", title: "Abrir uma conta Wise ou Nomad e pedir o cartão físico", category: "money", daysBefore: 180 },
  { key: "lodging-confirmed", title: "Confirmar todas as reservas de hospedagem", category: "lodging", daysBefore: 120, critical: true },
  { key: "travel-insurance", title: "Contratar seguro viagem", category: "health", daysBefore: 120, critical: true },
  { key: "remote-work", title: "Pesquisar cafés ou coworkings confiáveis", category: "connectivity", daysBefore: 120 },
  { key: "bank-travel-notice", title: "Avisar os bancos e preparar um cartão internacional reserva", category: "money", daysBefore: 120 },
  { key: "advance-tickets", title: "Comprar ingressos de atrações concorridas", category: "transport", daysBefore: 90 },
  { key: "main-trains", title: "Reservar as principais rotas de trem", category: "transport", daysBefore: 90, critical: true },
  { key: "type-g-adapter", title: "Comprar pelo menos um adaptador de tomada tipo G", category: "packing", daysBefore: 90 },
  { key: "medication", title: "Providenciar medicamentos, quantidade suficiente e receita em inglês", category: "health", daysBefore: 90, critical: true },
  { key: "esim", title: "Escolher e comprar um eSIM", category: "connectivity", daysBefore: 30 },
  { key: "packing-draft", title: "Rascunhar e testar a lista de bagagem", category: "packing", daysBefore: 30 },
  { key: "voucher-review", title: "Revisar todos os vouchers de hospedagem e passeios", category: "documents", daysBefore: 30, critical: true },
  { key: "essential-apps", title: "Instalar aplicativos essenciais e criar contas", category: "connectivity", daysBefore: 30 },
  { key: "flight-check-in", title: "Fazer o check-in online do voo assim que abrir", category: "transport", daysBefore: 1, critical: true },
  { key: "offline-documents", title: "Salvar passaporte, ETA, seguro, vouchers e primeiros trens offline", category: "documents", daysBefore: 7, critical: true },
  { key: "document-copies", title: "Manter cópias em nuvem e físicas dos documentos essenciais", category: "documents", daysBefore: 7, critical: true },
  { key: "trusted-contacts", title: "Compartilhar o itinerário e o plano de check-in com contatos de confiança", category: "documents", daysBefore: 7 },
  { key: "cards-funded", title: "Carregar os cartões de viagem com libras", category: "money", daysBefore: 1, critical: true },
  { key: "esim-test", title: "Instalar e testar o eSIM", category: "connectivity", daysBefore: 1 },
  { key: "carry-on-check", title: "Colocar adaptador, power bank carregado e medicamentos na bagagem de mão", category: "packing", daysBefore: 1, critical: true },
];

export function dateBeforeTrip(startDate: string, daysBefore: number) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysBefore);
  return date.toISOString().slice(0, 10);
}

export function isEnglandDestination(destination: string) {
  return /\b(england|inglaterra|united kingdom|reino unido|uk|london|londres|oxford|cambridge|york|iorque|bath|liverpool|manchester)\b/i.test(destination);
}

export function buildEnglandPreparationTasks(
  tripId: string,
  startDate: string,
  createdBy: string,
) {
  return englandPreparationTemplate.map((item) => ({
    trip_id: tripId,
    title: item.title,
    owner_id: createdBy,
    due_date: dateBeforeTrip(startDate, item.daysBefore),
    due_offset_days: item.daysBefore,
    category: item.category,
    is_critical: item.critical ?? false,
    template_key: `england-guide:${item.key}`,
    created_by: createdBy,
  }));
}
