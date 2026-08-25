export const locales = ["pt", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pt";
export const localeCookieName = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

// Used wherever a full BCP 47 tag is needed (Intl.*, the <html lang> attribute),
// as opposed to the short app-internal locale code used for cookies/messages.
export const localeTags: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
};
