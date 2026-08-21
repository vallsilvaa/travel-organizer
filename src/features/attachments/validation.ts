const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Mirrors the trip-attachments storage bucket's allowed_mime_types and
// file_size_limit (see the trip_attachments migration) so the UI can reject
// an unsupported upload before spending a round trip to storage.
export const allowedAttachmentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const maxAttachmentSizeBytes = 10 * 1024 * 1024;

export const attachmentItemTypes = ["itinerary", "task", "reservation"] as const;
export type AttachmentItemType = (typeof attachmentItemTypes)[number];

export function isValidAttachmentId(value: string) {
  return uuidPattern.test(value);
}

export function isAttachmentItemType(value: string): value is AttachmentItemType {
  return (attachmentItemTypes as readonly string[]).includes(value);
}

export type AttachmentValidationError =
  | "missing_file"
  | "file_too_large"
  | "unsupported_file_type"
  | "invalid_item_association";

export function validateAttachmentUpload(input: {
  file: File | null;
  itemType: string;
  itemId: string;
}): { success: true } | { success: false; error: AttachmentValidationError } {
  const { file, itemType, itemId } = input;

  if (!file || file.size === 0) {
    return { success: false, error: "missing_file" };
  }
  if (file.size > maxAttachmentSizeBytes) {
    return { success: false, error: "file_too_large" };
  }
  if (!(allowedAttachmentMimeTypes as readonly string[]).includes(file.type)) {
    return { success: false, error: "unsupported_file_type" };
  }
  if ((itemType && !itemId) || (!itemType && itemId)) {
    return { success: false, error: "invalid_item_association" };
  }
  if (itemType && !isAttachmentItemType(itemType)) {
    return { success: false, error: "invalid_item_association" };
  }

  return { success: true };
}

export function attachmentErrorMessage(error: AttachmentValidationError) {
  switch (error) {
    case "missing_file":
      return "Selecione um arquivo para enviar.";
    case "file_too_large":
      return "O arquivo deve ter no máximo 10 MB.";
    case "unsupported_file_type":
      return "Tipo de arquivo não suportado. Envie um PDF ou uma imagem (JPEG, PNG, WEBP ou HEIC).";
    case "invalid_item_association":
      return "Não foi possível associar o anexo ao item selecionado.";
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Storage keys are `${tripId}/${uuid}-${sanitizedFileName}` so RLS on
// storage.objects can authorize by trip folder alone.
export function sanitizeFileNameForStorage(fileName: string) {
  const trimmed = fileName.trim().slice(-150);
  return trimmed.replace(/[^a-zA-Z0-9.\-_]/g, "_") || "file";
}
