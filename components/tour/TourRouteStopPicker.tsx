"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { RouteStop } from "@/lib/tour-route-waypoints";

type LevelGroup = { id: string; label: string };

type Props = {
  id?: string;
  label: string;
  value: string;
  stops: RouteStop[];
  levels: LevelGroup[];
  onChange: (sceneId: string) => void;
};

/**
 * Picker tujuan rute — Void solid (bukan native OS select).
 */
export default function TourRouteStopPicker({ id, label, value, stops, levels, onChange }: Props) {
  const { t, content } = useTourLanguage();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listId = `${fieldId}-list`;
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = stops.find((stop) => stop.sceneId === value) ?? stops[0];
  const navStops = stops.filter((stop) => stop.kind === "current");
  const areaStops = stops.filter((stop) => stop.kind !== "current");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function renderStopButton(stop: RouteStop) {
    const active = stop.sceneId === value;
    return (
      <button
        key={stop.id}
        type="button"
        role="option"
        aria-selected={active}
        onClick={() => {
          onChange(stop.sceneId);
          setOpen(false);
        }}
        className={`flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm transition ${
          active ? "bg-signal/20 font-semibold text-ink" : "text-ink/90 hover:bg-panel"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{content(stop.label)}</span>
        {active && <Check className="size-4 shrink-0 text-signal" aria-hidden="true" />}
      </button>
    );
  }

  return (
    <div ref={root} className="relative">
      <label htmlFor={fieldId} className="mb-1.5 block font-display text-[11px] font-semibold tracking-wide text-fog">
        {label}
      </label>
      <button
        id={fieldId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border bg-void px-3 text-left text-sm font-semibold text-ink outline-none transition hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        style={{ borderColor: "var(--hairline)" }}
      >
        <span className="min-w-0 flex-1 truncate">{selected ? content(selected.label) : t("Pilih titik")}</span>
        <ChevronDown className={`size-4 shrink-0 text-fog transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={fieldId}
          className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-[80] max-h-60 overflow-y-auto overscroll-contain rounded-xl border py-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.55)]"
          style={{ borderColor: "var(--hairline-strong)", backgroundColor: "#1C0A0E" }}
        >
          {navStops.length > 0 && (
            <div className="py-1">
              <p className="px-3 py-1 text-[10px] font-semibold tracking-wide text-fog uppercase">
                {t("Navigasi")}
              </p>
              {navStops.map(renderStopButton)}
            </div>
          )}
          {levels.map((level) => {
            const levelStops = areaStops.filter((stop) => stop.levelId === level.id);
            if (!levelStops.length) return null;
            return (
              <div key={level.id} className="py-1">
                <p className="px-3 py-1 text-[10px] font-semibold tracking-wide text-fog uppercase">
                  {content(level.label)}
                </p>
                {levelStops.map(renderStopButton)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
