import type messages from "../messages/pt.json";

// pt.json is the source of truth for which keys exist; this makes
// useTranslations()/getTranslations() namespace and key arguments
// type-checked against it everywhere in the app.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
