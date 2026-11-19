import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { parseTourLanguage, TOUR_LANGUAGE_COOKIE, translateTourMessage } from "./tour-language";

export async function getTourLanguage() {
  return parseTourLanguage((await cookies()).get(TOUR_LANGUAGE_COOKIE)?.value);
}

export const getTourLanguageData = cache(async () => {
  const [initialLanguage, translations] = await Promise.all([
    getTourLanguage(),
    prisma.tourContentTranslation.findMany({ select: { source: true, english: true } }),
  ]);
  return {
    initialLanguage,
    translations: Object.fromEntries(translations.map(row => [row.source, row.english])),
  };
});

export async function getTourTranslator() {
  const language = await getTourLanguage();
  return (message: string, values?: Record<string, string | number>) => translateTourMessage(language, message, values);
}
