"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { Pencil } from "lucide-react";

export default function TourEditorLink({ href, label, rail = false }: { href: string; label: string; rail?: boolean }) {
  const { t } = useTourLanguage();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={t("{label} (tab baru)", { label: t(label) })}
      className={rail
        ? "tour-tool-btn pointer-events-auto relative focus-visible:outline-2 focus-visible:outline-white"
        : "inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#E31E2D]"}>
      <Pencil aria-hidden="true" className={rail ? "size-5" : "size-4 shrink-0"} />
      <span className={rail ? "sr-only" : undefined}>{t(label)}</span>
    </a>
  );
}
