// Where a signed-in user lands is decided here, server-side, from their
// own profile row - never from anything the client sends. Traveler-only
// (or no role at all, which shouldn't normally happen but fails toward
// the safer default) goes to the existing dashboard; organizer-only goes
// straight to the organizer panel; both goes to the mode selector so the
// user picks (see #153).
//
// Plain function, not a Server Action - "use server" files may only
// export async functions, and this one is a pure sync helper reused by
// both signIn() and tests.
export function postSignInPath(
  profile: { is_traveler: boolean; is_organizer: boolean } | null,
): string {
  const isTraveler = profile?.is_traveler ?? true;
  const isOrganizer = profile?.is_organizer ?? false;

  if (isTraveler && isOrganizer) {
    return "/auth/choose-mode";
  }
  if (isOrganizer) {
    return "/organizer";
  }
  return "/dashboard";
}
