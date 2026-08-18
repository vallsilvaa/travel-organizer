import { taskCategories, type TaskCategory } from "./templates";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type TaskFieldErrors = Partial<Record<
  "title" | "owner" | "dueDate" | "category" | "referenceLabel" | "referenceUrl",
  string
>>;

export type TaskInput = {
  title: string;
  ownerId: string | null;
  dueDate: string | null;
  category: TaskCategory;
  isCritical: boolean;
  referenceLabel: string | null;
  referenceUrl: string | null;
};

export function isValidTaskId(value: string) {
  return uuidPattern.test(value);
}

export function validateTaskInput(formData: FormData):
  | { success: true; data: TaskInput }
  | { success: false; errors: TaskFieldErrors } {
  const title = String(formData.get("title") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim() || null;
  const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "other").trim() as TaskCategory;
  const isCritical = formData.get("isCritical") === "on";
  const referenceLabel = String(formData.get("referenceLabel") ?? "").trim() || null;
  const referenceUrl = String(formData.get("referenceUrl") ?? "").trim() || null;
  const errors: TaskFieldErrors = {};

  if (!title || title.length > 200) {
    errors.title = "Enter a task with up to 200 characters.";
  }
  if (ownerId && !isValidTaskId(ownerId)) {
    errors.owner = "Choose a valid task owner.";
  }
  if (
    dueDate &&
    (!datePattern.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)))
  ) {
    errors.dueDate = "Enter a valid due date.";
  }
  if (!taskCategories.includes(category)) {
    errors.category = "Choose a valid preparation category.";
  }
  if (referenceLabel && referenceLabel.length > 100) {
    errors.referenceLabel = "Use a reference label with up to 100 characters.";
  }
  if (referenceLabel && !referenceUrl) {
    errors.referenceUrl = "Add the HTTPS address for this reference.";
  }
  if (referenceUrl) {
    try {
      const url = new URL(referenceUrl);
      if (url.protocol !== "https:" || referenceUrl.length > 500) {
        errors.referenceUrl = "Enter a secure HTTPS address with up to 500 characters.";
      }
    } catch {
      errors.referenceUrl = "Enter a valid HTTPS address.";
    }
  }

  return Object.keys(errors).length
    ? { success: false, errors }
    : {
        success: true,
        data: {
          title,
          ownerId,
          dueDate,
          category,
          isCritical,
          referenceLabel,
          referenceUrl,
        },
      };
}
