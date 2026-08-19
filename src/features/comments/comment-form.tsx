"use client";

import { useActionState, useEffect, useRef } from "react";
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
      toast.success(comment ? "Comment updated." : "Comment added.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [comment, state]);

  const fieldId = `comment-${comment?.id ?? itemType + itemId}`;

  return (
    <form ref={formRef} action={formAction} className="mt-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="itemType" value={itemType} />
      {comment ? <input type="hidden" name="commentId" value={comment.id} /> : null}
      <Label className="sr-only" htmlFor={fieldId}>
        {comment ? "Edit comment" : "Add comment"}
      </Label>
      <Textarea
        id={fieldId}
        required
        maxLength={2000}
        name="body"
        defaultValue={comment?.body}
        placeholder="Add context or a decision..."
        rows={comment ? 2 : 3}
        className="text-sm"
      />
      <div className="mt-2 flex justify-end">
        <Button disabled={pending} size="sm">
          {pending ? "Saving..." : comment ? "Save" : "Comment"}
        </Button>
      </div>
    </form>
  );
}
