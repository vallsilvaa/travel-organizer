import { defaultLocale, isLocale, type Locale } from "@/i18n/locale";

// Free-text suggestions for the "Atividade" combobox (#230/R03) - not a
// closed enum stored in the DB (unlike e.g. reservationTypes), just a
// starting point the visitor can ignore entirely or extend with their own
// text. pt/en lists are kept positionally aligned so swapping locale doesn't
// change the number or intent of suggestions, only their language.
const activityVerbsByLocale: Record<Locale, string[]> = {
  pt: [
    "Check-in",
    "Check-out",
    "Ida para",
    "Volta para",
    "Chegada em",
    "Partida de",
    "Traslado para",
    "Pegar voo para",
    "Pegar trem para",
    "Pegar ônibus para",
    "Pegar metrô para",
    "Alugar carro em",
    "Devolver carro em",
    "Visitar",
    "Conhecer",
    "Tour",
    "Passeio por",
    "Caminhada por",
    "Trilha",
    "Visita guiada",
    "Assistir",
    "Show de",
    "Musical",
    "Jogo de",
    "Exposição",
    "Museu",
    "Café da manhã em",
    "Almoçar em",
    "Jantar em",
    "Degustação em",
    "Drinks em",
    "Compras em",
    "Feira de",
    "Encontro com",
    "Descansar em",
    "Fotografar",
    "Pôr do sol em",
    "Praia",
    "Spa em",
    "Evento",
  ],
  en: [
    "Check-in",
    "Check-out",
    "Head to",
    "Return to",
    "Arrival in",
    "Departure from",
    "Transfer to",
    "Catch flight to",
    "Catch train to",
    "Catch bus to",
    "Catch subway to",
    "Rent car in",
    "Return car in",
    "Visit",
    "Explore",
    "Tour",
    "Walk around",
    "Walking tour of",
    "Hike",
    "Guided tour",
    "Watch",
    "Show at",
    "Musical",
    "Game at",
    "Exhibition",
    "Museum",
    "Breakfast at",
    "Lunch at",
    "Dinner at",
    "Tasting at",
    "Drinks at",
    "Shopping in",
    "Market at",
    "Meet with",
    "Relax at",
    "Photograph",
    "Sunset at",
    "Beach",
    "Spa at",
    "Event",
  ],
};

export function getActivityVerbs(locale: string): string[] {
  return activityVerbsByLocale[isLocale(locale) ? locale : defaultLocale];
}

// The final stored title is always this join, never re-split back into its
// parts (D10/#230) - "activity" (the combobox) is an optional prefix,
// "info" (the plain text field) is the only required part.
export function combineActivityTitle(activity: string, info: string): string {
  return [activity, info]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}
