import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
  return new Intl.DateTimeFormat("en", {
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
    <section className="mt-4">
      <Separator className="mb-4" />
      <h4 className="text-sm font-semibold text-foreground">
        Comments {comments.length ? `(${comments.length})` : ""}
      </h4>
      {comments.length ? (
        <ol className="mt-3 space-y-3">
          {comments.map((comment) => (
            <li key={comment.id}>
              <Card size="sm" className="rounded-xl shadow-sm">
                <CardContent>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      {participantNames.get(comment.author_id) ?? "Traveler"}
                    </p>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={comment.created_at}
                    >
                      {formatCommentTime(comment.created_at)}
                      {comment.updated_at !== comment.created_at
                        ? " · edited"
                        : ""}
                    </time>
                  </div>
                  <p className="mt-2 leading-6 whitespace-pre-wrap text-foreground/80">
                    {comment.body}
                  </p>
                  {comment.author_id === currentUserId ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-primary">
                        Edit
                      </summary>
                      <CommentForm
                        comment={comment}
                        itemId={itemId}
                        itemType={itemType}
                        tripId={tripId}
                      />
                      <form action={deleteComment} className="mt-2 text-right">
                        <input type="hidden" name="tripId" value={tripId} />
                        <input
                          type="hidden"
                          name="commentId"
                          value={comment.id}
                        />
                        <Button
                          size="xs"
                          variant="link"
                          className="font-semibold text-destructive"
                        >
                          Delete comment
                        </Button>
                      </form>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No comments yet.</p>
      )}
      <CommentForm itemId={itemId} itemType={itemType} tripId={tripId} />
    </section>
  );
}
