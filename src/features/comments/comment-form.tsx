"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  createComment,
  updateComment,
  type CommentActionState,
} from "./actions";
import type { CommentItemType } from "./validation";

type CommentFormProps = {
  comment?: { id: string; body: string };
  itemId: string;
  itemType: CommentItemType;
  tripId: string;
};

const initialState: CommentActionState = {};

export function CommentForm({ comment, itemId, itemType, tripId }: CommentFormProps) {
  const t = useTranslations("comments");
  const [state, formAction, pending] = useActionState(
    comment ? updateComment : createComment,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && !comment) {
      formRef.current?.reset();
    }
    if (state.success) {
      toast.success(comment ? t("toastUpdated") : t("toastAdded"));
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [comment, state, t]);

  const fieldId = `comment-${comment?.id ?? itemType + itemId}`;

  return (
    <form ref={formRef} action={formAction} className="mt-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="itemType" value={itemType} />
      {comment ? <input type="hidden" name="commentId" value={comment.id} /> : null}
      <Label className="sr-only" htmlFor={fieldId}>
        {comment ? t("editAriaLabel") : t("addAriaLabel")}
      </Label>
      <Textarea
        id={fieldId}
        required
        maxLength={2000}
        name="body"
        defaultValue={comment?.body}
        placeholder={t("bodyPlaceholder")}
        rows={comment ? 2 : 3}
        className="text-sm"
      />
      <div className="mt-2 flex justify-end">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? t("savePending") : comment ? t("save") : t("add")}
        </Button>
      </div>
    </form>
  );
}
