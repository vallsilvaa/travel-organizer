import { ConfirmDeleteForm } from "@/components/confirm-delete-form";

import { deleteComment } from "./actions";
import { CommentForm } from "./comment-form";
import type { CommentItemType } from "./validation";

export type ItemComment = {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
  updated_at: string;
};

type CommentThreadProps = {
  comments: ItemComment[];
  currentUserId: string;
  itemId: string;
  itemType: CommentItemType;
  participantNames: Map<string, string>;
  tripId: string;
};

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CommentThread({
  comments,
  currentUserId,
  itemId,
  itemType,
  participantNames,
  tripId,
}: CommentThreadProps) {
  return (
    <section className="mt-4 border-t border-slate-200 pt-4">
      <h4 className="text-sm font-semibold text-slate-800">
        Comentários {comments.length ? `(${comments.length})` : ""}
      </h4>
      {comments.length ? (
        <ol className="mt-3 space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">
                  {participantNames.get(comment.author_id) ?? "Viajante"}
                </p>
                <time className="text-xs text-slate-500" dateTime={comment.created_at}>
                  {formatCommentTime(comment.created_at)}
                  {comment.updated_at !== comment.created_at ? " · editado" : ""}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{comment.body}</p>
              {comment.author_id === currentUserId ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-sky-700">Editar</summary>
                  <CommentForm comment={comment} itemId={itemId} itemType={itemType} tripId={tripId} />
                  <div className="mt-2 text-right">
                    <ConfirmDeleteForm
                      action={deleteComment}
                      hiddenFields={{ tripId, commentId: comment.id }}
                      title="Excluir comentário?"
                      description="Isso vai remover permanentemente este comentário da conversa."
                      triggerLabel="Excluir comentário"
                      triggerClassName="h-auto p-0 text-xs text-destructive"
                    />
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Nenhum comentário ainda.</p>
      )}
      <CommentForm itemId={itemId} itemType={itemType} tripId={tripId} />
    </section>
  );
}
