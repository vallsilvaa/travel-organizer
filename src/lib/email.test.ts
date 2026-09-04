import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "./email";

describe("sendEmail", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("REMINDER_EMAIL_FROM", "notify@example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const input = {
    to: "traveler@example.com",
    subject: "Subject",
    html: "<p>Body</p>",
    text: "Body",
  };

  it("returns the provider message id on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email-1" }),
    }));

    const result = await sendEmail(input);

    expect(result).toEqual({ success: true, messageId: "email-1" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-resend-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "notify@example.com",
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      }),
    );
  });

  it("reports an http_<status> error when the provider rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422 }));

    const result = await sendEmail(input);

    expect(result).toEqual({ success: false, error: "http_422" });
  });

  it("reports a network_error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    const result = await sendEmail(input);

    expect(result).toEqual({ success: false, error: "network_error" });
  });

  it("reports not_configured without calling fetch when env vars are missing", async () => {
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", vi.fn());

    const result = await sendEmail(input);

    expect(result).toEqual({ success: false, error: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
