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
    errors.title = "Informe uma tarefa com até 200 caracteres.";
  }
  if (ownerId && !isValidTaskId(ownerId)) {
    errors.owner = "Escolha um responsável válido.";
  }
  if (
    dueDate &&
    (!datePattern.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)))
  ) {
    errors.dueDate = "Informe uma data limite válida.";
  }
  if (!taskCategories.includes(category)) {
    errors.category = "Escolha uma categoria de preparação válida.";
  }
  if (referenceLabel && referenceLabel.length > 100) {
    errors.referenceLabel = "Use um rótulo de referência com até 100 caracteres.";
  }
  if (referenceLabel && !referenceUrl) {
    errors.referenceUrl = "Adicione o endereço HTTPS para esta referência.";
  }
  if (referenceUrl) {
    try {
      const url = new URL(referenceUrl);
      if (url.protocol !== "https:" || referenceUrl.length > 500) {
        errors.referenceUrl = "Informe um endereço HTTPS seguro com até 500 caracteres.";
      }
    } catch {
      errors.referenceUrl = "Informe um endereço HTTPS válido.";
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
