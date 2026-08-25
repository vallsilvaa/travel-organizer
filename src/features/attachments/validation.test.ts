import { describe, expect, it } from "vitest";

import {
  formatFileSize,
  maxAttachmentSizeBytes,
  sanitizeFileNameForStorage,
  validateAttachmentUpload,
} from "./validation";

function makeFile(name: string, type: string, size: number) {
  const file = new File([new Uint8Array(Math.min(size, 16))], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateAttachmentUpload", () => {
  it("accepts a supported file within the size limit", () => {
    const result = validateAttachmentUpload({
      file: makeFile("passport.pdf", "application/pdf", 1024),
      itemType: "",
      itemId: "",
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects a missing file", () => {
    const result = validateAttachmentUpload({ file: null, itemType: "", itemId: "" });
    expect(result).toEqual({ success: false, error: "missing_file" });
  });

  it("rejects a file over the size limit", () => {
    const result = validateAttachmentUpload({
      file: makeFile("big.pdf", "application/pdf", maxAttachmentSizeBytes + 1),
      itemType: "",
      itemId: "",
    });
    expect(result).toEqual({ success: false, error: "file_too_large" });
  });

  it("rejects an unsupported file type", () => {
    const result = validateAttachmentUpload({
      file: makeFile("archive.zip", "application/zip", 1024),
      itemType: "",
      itemId: "",
    });
    expect(result).toEqual({ success: false, error: "unsupported_file_type" });
  });

  it("accepts a valid item association", () => {
    const result = validateAttachmentUpload({
      file: makeFile("ticket.pdf", "application/pdf", 1024),
      itemType: "itinerary",
      itemId: "27823996-ec50-4cc2-8506-a29d07b86f94",
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects an item type without a matching item id", () => {
    const result = validateAttachmentUpload({
      file: makeFile("ticket.pdf", "application/pdf", 1024),
      itemType: "itinerary",
      itemId: "",
    });
    expect(result).toEqual({ success: false, error: "invalid_item_association" });
  });

  it("rejects an unsupported item type", () => {
    const result = validateAttachmentUpload({
      file: makeFile("ticket.pdf", "application/pdf", 1024),
      itemType: "not-a-type",
      itemId: "27823996-ec50-4cc2-8506-a29d07b86f94",
    });
    expect(result).toEqual({ success: false, error: "invalid_item_association" });
  });
});

describe("formatFileSize", () => {
  it("formats bytes, kilobytes, and megabytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("sanitizeFileNameForStorage", () => {
  it("replaces unsafe characters and keeps extensions", () => {
    expect(sanitizeFileNameForStorage("passport (final)!.pdf")).toBe("passport__final__.pdf");
  });

  it("falls back to a default name when nothing survives sanitizing", () => {
    expect(sanitizeFileNameForStorage("   ")).toBe("file");
  });
});
