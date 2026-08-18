import { describe, expect, it } from "vitest";

import {
  isCommentItemType,
  isValidCommentId,
  validateCommentBody,
} from "./validation";

describe("comment validation", () => {
  it("normalizes a valid comment", () => {
    expect(validateCommentBody("  Meet by the main entrance.  ")).toEqual({
      success: true,
      body: "Meet by the main entrance.",
    });
  });

  it("rejects an empty comment", () => {
    expect(validateCommentBody("   ")).toEqual({
      success: false,
      error: "Enter a comment with up to 2,000 characters.",
    });
  });

  it("recognizes supported item types and UUIDs", () => {
    expect(isCommentItemType("itinerary")).toBe(true);
    expect(isCommentItemType("task")).toBe(true);
    expect(isCommentItemType("expense")).toBe(false);
    expect(isValidCommentId("27823996-ec50-4cc2-8506-a29d07b86f94")).toBe(true);
  });
});
