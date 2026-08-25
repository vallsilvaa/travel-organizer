// Validation functions return semantic error codes (e.g. "titleRequired")
// rather than literal strings, since they run outside any render context
// and can't know the active locale. Server Actions resolve those codes
// through their own scoped translator (`errors.<code>`) right before
// returning state to the client - this is the one bit of that plumbing
// shared across every feature's action file.
export function translateFieldErrors<T extends Record<string, string | undefined>>(
  // next-intl's per-namespace Translator type only accepts its own literal
  // key union, which this helper (called with a dynamic `errors.<code>`
  // string) can't satisfy structurally - `any` here is a deliberate, narrow
  // escape hatch, not a loss of type safety for callers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string,
  errors: T,
): T {
  const translated = {} as T;
  for (const [field, code] of Object.entries(errors)) {
    if (code) {
      (translated as Record<string, string>)[field] = t(`errors.${code}`);
    }
  }
  return translated;
}
