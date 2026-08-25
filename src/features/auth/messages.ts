import { getTranslations } from "next-intl/server";

const messageCodes = [
  "authentication_required",
  "check_email",
  "invalid_credentials",
  "invalid_email",
  "invalid_name",
  "invalid_password",
  "password_mismatch",
  "rate_limited",
  "signup_failed",
  "callback_failed",
  "check_email_reset",
  "reset_link_invalid",
  "password_update_failed",
  "password_updated",
  "invalid_display_name",
  "profile_update_failed",
  "profile_updated",
] as const;

export type AuthMessageCode = (typeof messageCodes)[number];

function isAuthMessageCode(value?: string): value is AuthMessageCode {
  return !!value && (messageCodes as readonly string[]).includes(value);
}

export async function getAuthMessage(code?: string) {
  if (!isAuthMessageCode(code)) {
    return null;
  }

  const t = await getTranslations("auth.messages");
  return t(code);
}
