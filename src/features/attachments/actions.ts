"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  attachmentErrorMessage,
  isValidAttachmentId,
  sanitizeFileNameForStorage,
  validateAttachmentUpload,
} from "./validation";

export type AttachmentActionState = {
  message?: string;
  success?: boolean;
};

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  return { supabase, user };
}

export async function uploadAttachment(
  _previousState: AttachmentActionState,
  formData: FormData,
): Promise<AttachmentActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const itemType = String(formData.get("itemType") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const file = formData.get("file");

  if (!isValidAttachmentId(tripId)) {
    return { message: "Não foi possível identificar a viagem." };
  }

  const validation = validateAttachmentUpload({
    file: file instanceof File ? file : null,
    itemType,
    itemId,
  });
  if (!validation.success) {
    return { message: attachmentErrorMessage(validation.error) };
  }

  const uploadedFile = file as File;
  const { supabase, user } = await authenticatedClient();
  const storagePath = `${tripId}/${crypto.randomUUID()}-${sanitizeFileNameForStorage(uploadedFile.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("trip-attachments")
    .upload(storagePath, uploadedFile, { contentType: uploadedFile.type });

  if (uploadError) {
    return { message: "Não foi possível enviar o arquivo. Verifique seu acesso à viagem e tente novamente." };
  }

  const { error: insertError } = await supabase.from("trip_attachments").insert({
    trip_id: tripId,
    item_type: itemType || null,
    item_id: itemId || null,
    storage_path: storagePath,
    file_name: uploadedFile.name.slice(-255),
    content_type: uploadedFile.type,
    size_bytes: uploadedFile.size,
    created_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from("trip-attachments").remove([storagePath]);
    return { message: "Não foi possível registrar o anexo. Tente novamente." };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteAttachment(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const storagePath = String(formData.get("storagePath") ?? "");

  if (!isValidAttachmentId(tripId) || !isValidAttachmentId(attachmentId) || !storagePath) {
    return;
  }

  const { supabase } = await authenticatedClient();
  const { error } = await supabase
    .from("trip_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("trip_id", tripId);

  if (!error) {
    await supabase.storage.from("trip-attachments").remove([storagePath]);
  }

  revalidatePath(`/trips/${tripId}`);
}
