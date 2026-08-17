const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type TaskFieldErrors = Partial<Record<"title" | "owner" | "dueDate", string>>;

export type TaskInput = {
  title: string;
  ownerId: string | null;
  dueDate: string | null;
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

  return Object.keys(errors).length
    ? { success: false, errors }
    : { success: true, data: { title, ownerId, dueDate } };
}
