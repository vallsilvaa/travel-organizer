import {
  createFormatter as createRealFormatter,
  createTranslator as createRealTranslator,
} from "use-intl/core";

import ptMessages from "../messages/pt.json";

// Shared by test files that `vi.mock("next-intl")` / `vi.mock("next-intl/server")`
// so component tests don't need a real NextIntlClientProvider (or a request-scoped
// cookie). Delegates to use-intl's real formatting engine (ICU interpolation,
// pluralization, dates) against the real pt.json, so assertions on rendered
// copy - including interpolated/pluralized strings like "2 críticas em aberto" -
// stay meaningful instead of matching a hand-duplicated stub.
const dateTimeFormats = {
  short: { dateStyle: "short" },
  medium: { dateStyle: "medium" },
  long: { dateStyle: "long" },
} as const;

export function createTranslator(namespace?: string) {
  // Namespace is a caller-supplied runtime string here, not one of the
  // literal keys createTranslator's generics expect - this is test-only
  // glue standing in for next-intl's own (differently-typed) mocked module,
  // so the exact key space isn't meaningful to type-check at this boundary.
  return createRealTranslator({
    locale: "pt",
    timeZone: "UTC",
    messages: ptMessages,
    namespace,
  } as Parameters<typeof createRealTranslator>[0]);
}

export function createFormatter() {
  return createRealFormatter({
    locale: "pt",
    timeZone: "UTC",
    formats: { dateTime: dateTimeFormats },
  });
}

export { ptMessages };
