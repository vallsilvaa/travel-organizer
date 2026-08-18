"use client";

import { useActionState, useEffect, useRef } from "react";

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
  }, [comment, state.success]);

  return (
    <form ref={formRef} action={formAction} className="mt-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="itemType" value={itemType} />
      {comment ? <input type="hidden" name="commentId" value={comment.id} /> : null}
      <label className="sr-only" htmlFor={`comment-${comment?.id ?? itemType + itemId}`}>
        {comment ? "Edit comment" : "Add comment"}
      </label>
      <textarea
        id={`comment-${comment?.id ?? itemType + itemId}`}
        required
        maxLength={2000}
        name="body"
        defaultValue={comment?.body}
        placeholder="Add context or a decision..."
        rows={comment ? 2 : 3}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          {state.error ? <p role="alert" className="text-xs text-red-700">{state.error}</p> : null}
          {state.success ? <p className="text-xs text-emerald-700">{comment ? "Comment updated." : "Comment added."}</p> : null}
        </div>
        <button
          disabled={pending}
          className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {pending ? "Saving..." : comment ? "Save" : "Comment"}
        </button>
      </div>
    </form>
  );
}
