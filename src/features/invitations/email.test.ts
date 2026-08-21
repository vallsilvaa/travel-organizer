import { describe, expect, it } from "vitest";

import { buildInvitationEmail } from "./email";

describe("invitation email", () => {
  it("identifies who invited and which trip", () => {
    const message = buildInvitationEmail({
      appUrl: "https://travel.example.com/",
      tripDestination: "Lisbon",
      invitedByName: "Ana",
    });

    expect(message.subject).toContain("Lisbon");
    expect(message.text).toContain("Ana convidou você");
    expect(message.text).toContain("https://travel.example.com/dashboard");
  });

  it("escapes private content before placing it in HTML", () => {
    const message = buildInvitationEmail({
      appUrl: "https://travel.example.com",
      tripDestination: "<script>alert('x')</script>",
      invitedByName: "A&B",
    });

    expect(message.html).toContain("A&amp;B");
    expect(message.html).not.toContain("<script>");
  });
});
