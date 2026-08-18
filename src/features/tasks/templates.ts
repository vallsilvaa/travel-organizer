export const taskCategories = [
  "documents",
  "lodging",
  "money",
  "transport",
  "health",
  "connectivity",
  "packing",
  "other",
] as const;

export type TaskCategory = (typeof taskCategories)[number];

export const taskCategoryLabels: Record<TaskCategory, string> = {
  documents: "Documents",
  lodging: "Lodging",
  money: "Money",
  transport: "Transport",
  health: "Health",
  connectivity: "Connectivity",
  packing: "Packing",
  other: "Other",
};

type PreparationTemplateItem = {
  category: TaskCategory;
  critical?: boolean;
  daysBefore: 180 | 120 | 90 | 30 | 7 | 1;
  key: string;
  title: string;
};

export const englandPreparationTemplate: PreparationTemplateItem[] = [
  { key: "passport", title: "Check passport validity", category: "documents", daysBefore: 180, critical: true },
  { key: "eta", title: "Apply for the UK ETA", category: "documents", daysBefore: 180, critical: true },
  { key: "lodging-research", title: "Research refundable lodging options", category: "lodging", daysBefore: 180 },
  { key: "daily-budget", title: "Plan the daily travel budget", category: "money", daysBefore: 180 },
  { key: "travel-card", title: "Open a Wise or Nomad account and order the physical card", category: "money", daysBefore: 180 },
  { key: "lodging-confirmed", title: "Confirm all lodging reservations", category: "lodging", daysBefore: 120, critical: true },
  { key: "travel-insurance", title: "Purchase travel insurance", category: "health", daysBefore: 120, critical: true },
  { key: "remote-work", title: "Research reliable cafés or coworking spaces", category: "connectivity", daysBefore: 120 },
  { key: "bank-travel-notice", title: "Notify banks and prepare a backup international card", category: "money", daysBefore: 120 },
  { key: "advance-tickets", title: "Buy high-demand attraction tickets", category: "transport", daysBefore: 90 },
  { key: "main-trains", title: "Book the main train routes", category: "transport", daysBefore: 90, critical: true },
  { key: "type-g-adapter", title: "Buy at least one type G power adapter", category: "packing", daysBefore: 90 },
  { key: "medication", title: "Arrange medication, sufficient supply, and a prescription in English", category: "health", daysBefore: 90, critical: true },
  { key: "esim", title: "Choose and purchase an eSIM", category: "connectivity", daysBefore: 30 },
  { key: "packing-draft", title: "Draft and test the packing list", category: "packing", daysBefore: 30 },
  { key: "voucher-review", title: "Review all lodging and tour vouchers", category: "documents", daysBefore: 30, critical: true },
  { key: "essential-apps", title: "Install essential apps and create accounts", category: "connectivity", daysBefore: 30 },
  { key: "flight-check-in", title: "Complete online flight check-in when it opens", category: "transport", daysBefore: 1, critical: true },
  { key: "offline-documents", title: "Save passport, ETA, insurance, vouchers, and first trains offline", category: "documents", daysBefore: 7, critical: true },
  { key: "document-copies", title: "Keep cloud and physical copies of essential documents", category: "documents", daysBefore: 7, critical: true },
  { key: "trusted-contacts", title: "Share the itinerary and check-in plan with trusted contacts", category: "documents", daysBefore: 7 },
  { key: "cards-funded", title: "Load travel cards with pounds", category: "money", daysBefore: 1, critical: true },
  { key: "esim-test", title: "Install and test the eSIM", category: "connectivity", daysBefore: 1 },
  { key: "carry-on-check", title: "Pack adapter, charged power bank, and medication in carry-on", category: "packing", daysBefore: 1, critical: true },
];

export function dateBeforeTrip(startDate: string, daysBefore: number) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysBefore);
  return date.toISOString().slice(0, 10);
}

export function isEnglandDestination(destination: string) {
  return /\b(england|united kingdom|uk|london|oxford|cambridge|york|bath|liverpool|manchester)\b/i.test(destination);
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
