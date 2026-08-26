const emailPattern = /^\S+@\S+\.\S+$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const invitationRoles = ["traveler", "organizer"] as const;
export type InvitationRole = (typeof invitationRoles)[number];

// Built from a translator scoped to "categories.invitationRole" at each call
// site rather than a hardcoded record - this module has no render-time locale.
export function getInvitationRoleLabels(t: (role: InvitationRole) => string): Record<InvitationRole, string> {
  return Object.fromEntries(invitationRoles.map((role) => [role, t(role)])) as Record<InvitationRole, string>;
}

export function isInvitationRole(value: string): value is InvitationRole {
  return (invitationRoles as readonly string[]).includes(value);
}

export function normalizeInvitationEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidInvitationEmail(email: string) {
  return email.length <= 320 && emailPattern.test(email);
}

export function isValidInvitationId(value: string) {
  return uuidPattern.test(value);
}
