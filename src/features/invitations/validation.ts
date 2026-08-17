const emailPattern = /^\S+@\S+\.\S+$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeInvitationEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidInvitationEmail(email: string) {
  return email.length <= 320 && emailPattern.test(email);
}

export function isValidInvitationId(value: string) {
  return uuidPattern.test(value);
}
