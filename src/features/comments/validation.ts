const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CommentItemType = "itinerary" | "task";

export function isValidCommentId(value: string) {
  return uuidPattern.test(value);
}

export function isCommentItemType(value: string): value is CommentItemType {
  return value === "itinerary" || value === "task";
}

export function validateCommentBody(value: FormDataEntryValue | null) {
  const body = String(value ?? "").trim();
  return body && body.length <= 2000
    ? { success: true as const, body }
    : {
        success: false as const,
        error: "Enter a comment with up to 2,000 characters.",
      };
}
