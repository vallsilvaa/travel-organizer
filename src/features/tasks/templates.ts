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

export function dateBeforeTrip(startDate: string, daysBefore: number) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysBefore);
  return date.toISOString().slice(0, 10);
}
