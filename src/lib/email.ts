// Single call site for outbound transactional email (Resend's HTTP API, no
// SDK dependency). Previously duplicated verbatim between invitations and
// the task-reminders cron; every new email-sending feature should call this
// instead of re-implementing the fetch.
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { success: true; messageId: string | null }
  | { success: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.REMINDER_EMAIL_FROM;

  if (!resendApiKey || !emailFrom) {
    return { success: false, error: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `http_${response.status}` };
    }

    const body = (await response.json()) as { id?: string };
    return { success: true, messageId: body.id ?? null };
  } catch {
    return { success: false, error: "network_error" };
  }
}
