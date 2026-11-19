"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TOUR_LANGUAGE_COOKIE, translateTourContent, translateTourMessage, type TourLanguage } from "@/lib/tour-language";

const idOnly = (text: string, values?: Record<string, string | number>) => translateTourMessage("id", text, values);
const TourLanguageContext = createContext({
  enabled: false,
  language: "id" as TourLanguage,
  locale: "id-ID",
  t: idOnly,
  content: (value: string) => value,
  setLanguage: (_language: TourLanguage) => {},
});
export const useTourLanguage = () => useContext(TourLanguageContext);

export default function TourLanguageProvider({ initialLanguage, translations, children }: {
  initialLanguage: TourLanguage;
  translations: Record<string, string>;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  useEffect(() => {
    const root = document.documentElement;
    const original = root.lang;
    root.lang = language;
    return () => { root.lang = original; };
  }, [language]);

  const value = useMemo(() => ({
    enabled: true,
    language,
    locale: language === "en" ? "en-GB" : "id-ID",
    setLanguage(next: TourLanguage) {
      document.cookie = `${TOUR_LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setLanguage(next);
    },
    t(message: string, values?: Record<string, string | number>) {
      return translateTourMessage(language, message, values);
    },
    content(text: string) {
      return translateTourContent(language, translations, text);
    },
  }), [language, translations]);

  return <TourLanguageContext.Provider value={value}>{children}</TourLanguageContext.Provider>;
}

const languageOptions = [
  { code: "id", shortLabel: "ID", name: "Bahasa Indonesia" },
  { code: "en", shortLabel: "EN", name: "English" },
] as const;

export function TourLanguageToggle({ refresh = false, light = false, embedded = false }: { refresh?: boolean; light?: boolean; embedded?: boolean } = {}) {
  const router = useRouter();
  const { enabled, language, setLanguage, t } = useTourLanguage();
  if (!enabled) return null;

  const surface = light ? "border border-slate-200 bg-slate-100 text-slate-800" : "tour-chrome-pill";
  return (
    <div role="group" aria-label={t("Bahasa")} className={`flex h-11 shrink-0 items-stretch rounded-xl ${embedded ? "" : surface}`}>
      {languageOptions.map(({ code, shortLabel, name }) => {
        const active = language === code;
        const selectedStyle = light ? "bg-slate-800 text-white" : "bg-white/16 text-white ring-1 ring-inset ring-white/20";
        const idleStyle = light ? "text-slate-600 group-hover:bg-slate-200" : "text-ink/75 group-hover:bg-white/10";
        return (
          <button key={code} type="button" lang={code} title={name} aria-label={name} aria-pressed={active}
            onClick={() => {
              if (active) return;
              setLanguage(code);
              if (refresh) router.refresh();
            }}
            className={`group grid min-w-11 place-items-center rounded-lg focus-visible:-outline-offset-2 focus-visible:outline-2 ${light ? "focus-visible:outline-slate-800" : "focus-visible:outline-white"}`}>
            <span className={`grid h-6 min-w-8 place-items-center rounded-md text-xs font-semibold transition-colors ${active ? selectedStyle : idleStyle}`}>{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
