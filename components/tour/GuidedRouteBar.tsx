/*
  THESIS: Cockpit autopilot rute — progress legible, play/pause jelas; tolak HUD generik.
  OWN-WORLD: void glass #1C0A0E, signal #E31E2D, Chakra Petch, hairline hangat.
  STORY: Mitra putar rute otomatis antar scene, pause untuk eksplor, keluar kapan saja.
  FIRST VIEWPORT: Bar bawah full-bleed glass — play | judul rute + n/N + track | next | exit.
  FORM: Perluasan Void Portal cockpit (bukan clone EMR).
*/
"use client";

import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";

type Props = {
  fromTitle: string;
  toTitle: string;
  stepIndex: number;
  stepTotal: number;
  autoplay: boolean;
  canPrev: boolean;
  canNext: boolean;
  finished: boolean;
  onToggleAutoplay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
};

export function GuidedRouteBar({
  fromTitle,
  toTitle,
  stepIndex,
  stepTotal,
  autoplay,
  canPrev,
  canNext,
  finished,
  onToggleAutoplay,
  onPrev,
  onNext,
  onExit,
}: Props) {
  const progress = stepTotal > 0 ? ((stepIndex + 1) / stepTotal) * 100 : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[62] flex justify-center px-3 pb-4 sm:px-5 tour-nav-rise">
      <div
        className="tour-guided-bar pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl"
        style={
          {
            "--tour-guided-progress": String(Math.min(1, Math.max(0, progress / 100))),
          } as CSSProperties
        }
      >
        <div className="tour-guided-bar__track" aria-hidden />

        <div className="relative flex items-center gap-2 px-2.5 py-2.5 sm:gap-3 sm:px-3">
          <button
            type="button"
            onClick={onToggleAutoplay}
            disabled={finished && !autoplay}
            aria-pressed={autoplay}
            title={autoplay ? "Jeda putar otomatis" : "Putar rute otomatis"}
            className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-3.5 font-display text-xs font-bold transition duration-300 sm:px-4 ${
              autoplay
                ? "bg-white text-[#1C0A0E] shadow-[0_10px_24px_rgba(255,255,255,0.18)]"
                : "bg-[#E31E2D] text-white shadow-[0_12px_28px_rgba(227,30,45,0.35)] hover:bg-[#c41926]"
            } disabled:cursor-default disabled:opacity-45`}
          >
            {autoplay ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span className="hidden sm:inline">Jeda</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span className="hidden sm:inline">{finished ? "Ulangi" : "Putar"}</span>
              </>
            )}
          </button>

          <div className="min-w-0 flex-1 px-0.5">
            <p className="truncate font-display text-[11px] font-semibold leading-tight text-[#F8ECEE] sm:text-xs">
              <span className="text-[#F8ECEE]/75">{fromTitle}</span>
              <span className="mx-1.5 text-[#E31E2D]">→</span>
              <span>{toTitle}</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p
                className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[#C4A8AD]"
                data-guided-step={stepIndex + 1}
                data-guided-total={stepTotal}
              >
                {finished ? "Selesai" : `${stepIndex + 1} / ${stepTotal}`}
              </p>
              {autoplay && !finished && (
                <span className="tour-guided-bar__live inline-flex items-center gap-1 font-display text-[10px] font-semibold text-[#34d399]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
                  Auto
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              title="Scene sebelumnya"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgb(255_214_218_/_0.14)] bg-[#1C0A0E]/55 text-[#F8ECEE] transition hover:bg-[#3A161C] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              title="Scene berikutnya"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgb(255_214_218_/_0.14)] bg-[#1C0A0E]/55 text-[#F8ECEE] transition hover:bg-[#3A161C] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onExit}
              title="Keluar dari rute"
              className="ml-0.5 flex h-9 items-center gap-1.5 rounded-full border border-[color:rgb(255_214_218_/_0.14)] bg-[#1C0A0E]/55 px-2.5 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[#F8ECEE]/80 transition hover:border-[#E31E2D]/40 hover:text-white sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
