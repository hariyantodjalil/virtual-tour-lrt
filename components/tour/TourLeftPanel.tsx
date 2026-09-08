"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Home, MapPin, TrainFront } from "lucide-react";

type Props = {
  stationName: string;
  onPickStation: () => void;
  /** Default: Pilih Stasiun */
  pickLabel?: string;
  /** Default: / */
  homeHref?: string;
  clearUiControl?: ReactNode;
  tools?: ReactNode;
  /** Slot di bawah lokasi — mis. mini-map formasi gerbong */
  map?: ReactNode;
};

/** Dark glass — layout mockup, ukuran lebih compact */
const SURFACE_PILL =
  "rounded-full border border-white/12 bg-[#1c1c1e]/78 text-white backdrop-blur-md";
const ICON_DISK = "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white/12";

/**
 * Panel kiri virtual tour — struktur mengikuti mockup Figma, warna dark glass.
 */
export default function TourLeftPanel({
  stationName,
  onPickStation,
  pickLabel = "Pilih Stasiun",
  homeHref = "/",
  clearUiControl,
  tools,
  map,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-[58]">
      {/* Header kiri atas */}
      <div className="tour-panel-in pointer-events-auto flex w-[min(100vw,232px)] flex-col gap-1.5 overflow-visible bg-transparent p-1.5 sm:w-[248px] sm:p-2">
        {/* Home + Pilih */}
        <div className="flex items-center gap-1.5">
          <Link
            href={homeHref}
            className={`flex size-8 shrink-0 items-center justify-center transition hover:bg-white/10 ${SURFACE_PILL}`}
            aria-label="Beranda"
          >
            <Home className="size-3.5" strokeWidth={2.25} />
          </Link>
          <button
            type="button"
            onClick={onPickStation}
            className={`flex h-8 min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left text-[11px] font-semibold transition hover:bg-white/10 ${SURFACE_PILL}`}
          >
            <TrainFront className="size-3.5 shrink-0 opacity-90" />
            <span className="min-w-0 flex-1 truncate font-display">{pickLabel}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-70" strokeWidth={2.5} />
          </button>
        </div>

        {/* Lokasi Saat Ini */}
        <section className={`flex items-center gap-2 px-2 py-1.5 ${SURFACE_PILL}`}>
          <span className={ICON_DISK}>
            <MapPin className="size-3.5 text-white" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium text-white/65">Lokasi Saat Ini</p>
            <p className="truncate font-display text-sm leading-tight font-bold text-white">
              {stationName}
            </p>
          </div>
        </section>

        {map ? <div className="pointer-events-auto">{map}</div> : null}
      </div>

      {/* Rail tools — vertikal di tengah kiri */}
      {(clearUiControl || tools) && (
        <div className="pointer-events-auto absolute top-1/2 left-2 z-[1] flex -translate-y-1/2 flex-col items-start gap-2 sm:left-3">
          {clearUiControl}
          {tools}
        </div>
      )}
    </div>
  );
}
