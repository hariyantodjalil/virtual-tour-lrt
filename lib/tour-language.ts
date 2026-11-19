import english from "./tour-messages-en.json";

export type TourLanguage = "id" | "en";
export const TOUR_LANGUAGE_COOKIE = "tour_language";

export function parseTourLanguage(value?: string): TourLanguage {
  return value === "en" ? "en" : "id";
}

export function translateTourMessage(language: TourLanguage, message: string, values?: Record<string, string | number>): string {
  const messages: Record<string, string> = english;
  const text = language === "en" && Object.hasOwn(messages, message) ? messages[message] : message;
  return values ? text.replace(/\{([a-zA-Z]+)\}/g, (placeholder, key: string) => Object.hasOwn(values, key) ? String(values[key]) : placeholder) : text;
}

export function translateTourContent(language: TourLanguage, translations: Record<string, string>, text: string): string {
  if (language === "id") return text;
  const lookup = (value: string) => {
    const key = tourTranslationSource(value);
    return Object.hasOwn(translations, key) ? translations[key] : translateTourMessage(language, value);
  };
  const whole = lookup(text);
  return whole === text && text.includes(" · ") ? text.split(" · ").map(lookup).join(" · ") : whole;
}

export function tourTranslationSource(value: string): string {
  return value.trim().toLocaleLowerCase("id-ID");
}
