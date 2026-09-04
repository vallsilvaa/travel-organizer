import {
  isClassification,
  isContinent,
  isPrepItemType,
  taskCategories,
  type Classification,
  type Continent,
  type PrepItemType,
  type TaskCategory,
} from "@/features/prep-catalog/shared";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const amountPattern = /^\d{1,12}(?:\.\d{1,2})?$/;
const currencyPattern = /^[A-Z]{3}$/;

export type PrepItemFieldErrors = Partial<
  Record<
    | "title"
    | "itemType"
    | "category"
    | "continent"
    | "country"
    | "city"
    | "classification"
    | "dueOffsetDays"
    | "currency"
    | "estimatedAmount"
    | "paidAmount"
    | "documentInstructions"
    | "assignedTo"
    | "itineraryItemId",
    string
  >
>;

export type PrepItemInput = {
  title: string;
  itemType: PrepItemType;
  category: TaskCategory;
  continent: Continent;
  country: string;
  city: string | null;
  classification: Classification;
  dueOffsetDays: number;
  currency: string | null;
  estimatedAmount: string | null;
  paidAmount: string | null;
  documentInstructions: string | null;
  assignedTo: string | null;
  itineraryItemId: string | null;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function isValidPrepItemId(value: string) {
  return uuidPattern.test(value);
}

export function validatePrepItemInput(formData: FormData):
  | { success: true; data: PrepItemInput }
  | { success: false; errors: PrepItemFieldErrors } {
  const title = String(formData.get("title") ?? "").trim();
  const itemType = String(formData.get("itemType") ?? "");
  const category = String(formData.get("category") ?? "other");
  const continent = String(formData.get("continent") ?? "");
  const country = String(formData.get("country") ?? "").trim();
  const city = optionalValue(formData.get("city"));
  const classification = String(formData.get("classification") ?? "");
  const rawDueOffsetDays = String(formData.get("dueOffsetDays") ?? "").trim();
  const currency = optionalValue(formData.get("currency"))?.toUpperCase() ?? null;
  const rawEstimatedAmount = optionalValue(formData.get("estimatedAmount"));
  const rawPaidAmount = optionalValue(formData.get("paidAmount"));
  const documentInstructions = optionalValue(formData.get("documentInstructions"));
  const rawAssignedTo = optionalValue(formData.get("assignedTo"));
  const assignedTo = rawAssignedTo === "none" ? null : rawAssignedTo;
  const rawItineraryItemId = optionalValue(formData.get("itineraryItemId"));
  const itineraryItemId = rawItineraryItemId === "none" ? null : rawItineraryItemId;
  const errors: PrepItemFieldErrors = {};

  if (!title || title.length > 200) {
    errors.title = "titleRequired";
  }
  if (!isPrepItemType(itemType)) {
    errors.itemType = "itemTypeInvalid";
  }
  if (!(taskCategories as readonly string[]).includes(category)) {
    errors.category = "categoryInvalid";
  }
  if (!isContinent(continent)) {
    errors.continent = "continentInvalid";
  }
  if (!country || country.length > 100) {
    errors.country = "countryRequired";
  }
  if (city && city.length > 200) {
    errors.city = "cityTooLong";
  }
  if (!isClassification(classification)) {
    errors.classification = "classificationInvalid";
  }

  const dueOffsetDays = Number(rawDueOffsetDays);
  if (
    !rawDueOffsetDays ||
    !Number.isInteger(dueOffsetDays) ||
    dueOffsetDays < 0 ||
    dueOffsetDays > 730
  ) {
    errors.dueOffsetDays = "dueOffsetDaysInvalid";
  }

  if (currency && !currencyPattern.test(currency)) {
    errors.currency = "currencyInvalid";
  }

  let estimatedAmount: string | null = null;
  if (rawEstimatedAmount) {
    if (!amountPattern.test(rawEstimatedAmount) || Number(rawEstimatedAmount) < 0) {
      errors.estimatedAmount = "estimatedAmountInvalid";
    } else {
      estimatedAmount = Number(rawEstimatedAmount).toFixed(2);
    }
  }

  let paidAmount: string | null = null;
  if (rawPaidAmount) {
    if (!amountPattern.test(rawPaidAmount) || Number(rawPaidAmount) < 0) {
      errors.paidAmount = "paidAmountInvalid";
    } else {
      paidAmount = Number(rawPaidAmount).toFixed(2);
    }
  }

  if (itemType === "document_request" && !documentInstructions) {
    errors.documentInstructions = "documentInstructionsRequired";
  }
  if (documentInstructions && documentInstructions.length > 2000) {
    errors.documentInstructions = "documentInstructionsTooLong";
  }

  if (assignedTo && !uuidPattern.test(assignedTo)) {
    errors.assignedTo = "assignedToInvalid";
  }
  if (itineraryItemId && !uuidPattern.test(itineraryItemId)) {
    errors.itineraryItemId = "itineraryItemInvalid";
  }

  return Object.keys(errors).length
    ? { success: false, errors }
    : {
        success: true,
        data: {
          title,
          itemType: itemType as PrepItemType,
          category: category as TaskCategory,
          continent: continent as Continent,
          country,
          city,
          classification: classification as Classification,
          dueOffsetDays,
          currency,
          estimatedAmount,
          paidAmount,
          documentInstructions,
          assignedTo,
          itineraryItemId,
        },
      };
}
