export { taskCategories, getTaskCategoryLabels, type TaskCategory } from "@/features/tasks/templates";

export const prepItemTypes = ["preparation", "document_request"] as const;
export type PrepItemType = (typeof prepItemTypes)[number];

export const classifications = ["required", "recommended", "optional"] as const;
export type Classification = (typeof classifications)[number];

export const continents = [
  "africa",
  "antarctica",
  "asia",
  "europe",
  "north_america",
  "oceania",
  "south_america",
] as const;
export type Continent = (typeof continents)[number];

// Built from a translator scoped to the relevant "categories.*" namespace at
// each call site (server or client) rather than a hardcoded record, since
// these modules have no access to the render-time locale on their own.
export function getPrepItemTypeLabels(t: (type: PrepItemType) => string): Record<PrepItemType, string> {
  return Object.fromEntries(prepItemTypes.map((type) => [type, t(type)])) as Record<PrepItemType, string>;
}

export function getClassificationLabels(t: (classification: Classification) => string): Record<Classification, string> {
  return Object.fromEntries(classifications.map((classification) => [classification, t(classification)])) as Record<Classification, string>;
}

export function getContinentLabels(t: (continent: Continent) => string): Record<Continent, string> {
  return Object.fromEntries(continents.map((continent) => [continent, t(continent)])) as Record<Continent, string>;
}

export function isPrepItemType(value: string): value is PrepItemType {
  return (prepItemTypes as readonly string[]).includes(value);
}

export function isClassification(value: string): value is Classification {
  return (classifications as readonly string[]).includes(value);
}

export function isContinent(value: string): value is Continent {
  return (continents as readonly string[]).includes(value);
}
