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

export function TourLanguageToggle({
  refresh = false,
  light = false,
  embedded = false,
  tone,
}: {
  refresh?: boolean;
  light?: boolean;
  embedded?: boolean;
  /** `brand` = di atas header signal merah portal/operate; `light` = permukaan putih; `tour` = chrome Void. */
  tone?: "tour" | "light" | "brand";
} = {}) {
  const router = useRouter();
  const { enabled, language, setLanguage, t } = useTourLanguage();
  if (!enabled) return null;

  const resolvedTone = tone ?? (light ? "light" : "tour");

  if (resolvedTone === "brand") {
    // Opaque white capsule on signal-red header: active = brand red fill.
    // Avoids Void chrome mud and translucent glass that looks dirty on #c41230.
    return (
      <div
        role="group"
        aria-label={t("Bahasa")}
        className="inline-flex h-9 shrink-0 items-stretch rounded-lg bg-white p-0.5 shadow-sm"
      >
        {languageOptions.map(({ code, shortLabel, name }) => {
          const active = language === code;
          return (
            <button
              key={code}
              type="button"
              lang={code}
              title={name}
              aria-label={name}
              aria-pressed={active}
              onClick={() => {
                if (active) return;
                setLanguage(code);
                if (refresh) router.refresh();
              }}
              className={`grid min-w-9 place-items-center rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:min-w-10 ${
                active
                  ? "bg-[#c41230] text-white"
                  : "text-[#c41230]/75 hover:bg-[#c41230]/10 hover:text-[#c41230]"
              }`}
            >
              {shortLabel}
            </button>
          );
        })}
      </div>
    );
  }

  const surface =
    resolvedTone === "light"
      ? "border border-slate-200 bg-slate-100 text-slate-800"
      : "tour-chrome-pill";
  const selectedStyle =
    resolvedTone === "light"
      ? "bg-slate-800 text-white"
      : "bg-white/16 text-white ring-1 ring-inset ring-white/20";
  const idleStyle =
    resolvedTone === "light"
      ? "text-slate-600 group-hover:bg-slate-200"
      : "text-ink/75 group-hover:bg-white/10";
  const focusStyle =
    resolvedTone === "light" ? "focus-visible:outline-slate-800" : "focus-visible:outline-white";

  return (
    <div
      role="group"
      aria-label={t("Bahasa")}
      className={`flex h-11 shrink-0 items-stretch rounded-lg ${embedded ? "" : surface}`}
    >
      {languageOptions.map(({ code, shortLabel, name }) => {
        const active = language === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            title={name}
            aria-label={name}
            aria-pressed={active}
            onClick={() => {
              if (active) return;
              setLanguage(code);
              if (refresh) router.refresh();
            }}
            className={`group grid min-w-11 place-items-center rounded-md focus-visible:-outline-offset-2 focus-visible:outline-2 ${focusStyle}`}
          >
            <span
              className={`grid h-6 min-w-8 place-items-center rounded-md text-xs font-semibold transition-colors ${
                active ? selectedStyle : idleStyle
              }`}
            >
              {shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
