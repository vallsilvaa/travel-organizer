"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  isCommentItemType,
  isValidCommentId,
  validateCommentBody,
} from "./validation";

export type CommentActionState = {
  error?: string;
  success?: boolean;
};

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  return { supabase, user };
}

export async function createComment(
  _previousState: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const itemType = String(formData.get("itemType") ?? "");
  const validation = validateCommentBody(formData.get("body"));

  if (
    !isValidCommentId(tripId) ||
    !isValidCommentId(itemId) ||
    !isCommentItemType(itemType)
  ) {
    return { error: "Não foi possível identificar o alvo do comentário." };
  }
  if (!validation.success) {
    return { error: validation.error };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("item_comments").insert({
    trip_id: tripId,
    item_type: itemType,
    itinerary_item_id: itemType === "itinerary" ? itemId : null,
    task_id: itemType === "task" ? itemId : null,
    body: validation.body,
    author_id: user.id,
  });

  if (error) {
    return { error: "Não foi possível adicionar este comentário. Verifique seu acesso à viagem." };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function updateComment(
  _previousState: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const tripId = String(formData.get("tripId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  const validation = validateCommentBody(formData.get("body"));

  if (!isValidCommentId(tripId) || !isValidCommentId(commentId)) {
    return { error: "Não foi possível identificar o comentário." };
  }
  if (!validation.success) {
    return { error: validation.error };
  }

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("item_comments")
    .update({ body: validation.body, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("trip_id", tripId)
    .eq("author_id", user.id);

  if (error) {
    return { error: "Não foi possível atualizar este comentário." };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteComment(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");

  if (!isValidCommentId(tripId) || !isValidCommentId(commentId)) {
    return;
  }

  const { supabase, user } = await authenticatedClient();
  await supabase
    .from("item_comments")
    .delete()
    .eq("id", commentId)
    .eq("trip_id", tripId)
    .eq("author_id", user.id);
  revalidatePath(`/trips/${tripId}`);
}
