import { describe, expect, it } from "vitest";

import {
  isValidInvitationEmail,
  isValidInvitationId,
  normalizeInvitationEmail,
} from "./validation";

describe("invitation validation", () => {
  it("normalizes and validates an email", () => {
    const email = normalizeInvitationEmail(" Organizer@Example.com ");

    expect(email).toBe("organizer@example.com");
    expect(isValidInvitationEmail(email)).toBe(true);
  });

  it("rejects invalid emails and invitation identifiers", () => {
    expect(isValidInvitationEmail("not-an-email")).toBe(false);
    expect(isValidInvitationId("not-an-id")).toBe(false);
  });

  it("accepts a UUID invitation identifier", () => {
    expect(
      isValidInvitationId("8f3f147b-8684-4ff1-b5c7-6814e4f57f73"),
    ).toBe(true);
  });
});
