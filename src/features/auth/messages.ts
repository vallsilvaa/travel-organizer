const messages = {
  authentication_required: "Sign in to continue.",
  check_email: "Check your email to confirm your account before signing in.",
  invalid_credentials: "Email or password is incorrect.",
  invalid_email: "Enter a valid email address.",
  invalid_name: "Enter a name with at least two characters.",
  invalid_password: "Use at least eight characters for your password.",
  password_mismatch: "The passwords do not match.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
  signup_failed: "We could not create your account. Try again.",
  callback_failed: "The confirmation link is invalid or has expired.",
} as const;

export type AuthMessageCode = keyof typeof messages;

export function getAuthMessage(code?: string) {
  if (!code || !(code in messages)) {
    return null;
  }

  return messages[code as AuthMessageCode];
}
