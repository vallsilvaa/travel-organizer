"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { notifyTripCollaborators } from "@/features/notifications/collaboration";
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

function tabForCommentItemType(itemType: string) {
  return itemType === "task" ? "preparation" : "itinerary";
}

export async function createComment(
  _previousState: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const t = await getTranslations("comments.actionErrors");
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const itemType = String(formData.get("itemType") ?? "");
  const validation = validateCommentBody(formData.get("body"));

  if (
    !isValidCommentId(tripId) ||
    !isValidCommentId(itemId) ||
    !isCommentItemType(itemType)
  ) {
    return { error: t("identifyTarget") };
  }
  if (!validation.success) {
    return { error: t(validation.error) };
  }

  const { supabase, user } = await authenticatedClient();
  const { data: created, error } = await supabase
    .from("item_comments")
    .insert({
      trip_id: tripId,
      item_type: itemType,
      itinerary_item_id: itemType === "itinerary" ? itemId : null,
      task_id: itemType === "task" ? itemId : null,
      body: validation.body,
      author_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: t("addFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  after(() =>
    notifyTripCollaborators({
      supabase,
      tripId,
      actorId: user.id,
      entityType: "item_comment",
      entityId: created.id,
      action: "created",
      itemLabel: validation.body.slice(0, 140),
      tab: tabForCommentItemType(itemType),
    }),
  );
  return { success: true };
}

export async function updateComment(
  _previousState: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const t = await getTranslations("comments.actionErrors");
  const tripId = String(formData.get("tripId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  const validation = validateCommentBody(formData.get("body"));

  if (!isValidCommentId(tripId) || !isValidCommentId(commentId)) {
    return { error: t("identifyComment") };
  }
  if (!validation.success) {
    return { error: t(validation.error) };
  }

  const { supabase, user } = await authenticatedClient();
  const { data: updated, error } = await supabase
    .from("item_comments")
    .update({ body: validation.body, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("trip_id", tripId)
    .eq("author_id", user.id)
    .select("item_type")
    .maybeSingle();

  if (error) {
    return { error: t("updateFailed") };
  }

  revalidatePath(`/trips/${tripId}`);
  if (updated) {
    after(() =>
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: user.id,
        entityType: "item_comment",
        entityId: commentId,
        action: "updated",
        itemLabel: validation.body.slice(0, 140),
        tab: tabForCommentItemType(updated.item_type),
      }),
    );
  }
  return { success: true };
}

export async function deleteComment(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");

  if (!isValidCommentId(tripId) || !isValidCommentId(commentId)) {
    return;
  }

  const { supabase, user } = await authenticatedClient();
  const { data: deleted } = await supabase
    .from("item_comments")
    .delete()
    .eq("id", commentId)
    .eq("trip_id", tripId)
    .eq("author_id", user.id)
    .select("item_type, body")
    .maybeSingle();
  revalidatePath(`/trips/${tripId}`);

  if (deleted) {
    after(() =>
      notifyTripCollaborators({
        supabase,
        tripId,
        actorId: user.id,
        entityType: "item_comment",
        entityId: commentId,
        action: "deleted",
        itemLabel: deleted.body.slice(0, 140),
        tab: tabForCommentItemType(deleted.item_type),
      }),
    );
  }
}
