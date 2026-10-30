"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Home, MapPin, TrainFront } from "lucide-react";
import type { TourLocationBreadcrumb } from "@/lib/tour-location-breadcrumb";

type Props = {
  stationName: string;
  locationBreadcrumb?: TourLocationBreadcrumb;
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
  locationBreadcrumb,
  onPickStation,
  pickLabel = "Pilih Stasiun",
  homeHref = "/",
  clearUiControl,
  tools,
  map,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-[58] md:right-0">
      {/* Header kiri atas */}
      <div className="pointer-events-auto flex w-[min(100vw,288px)] flex-col gap-1 overflow-visible bg-transparent p-2 md:gap-1.5">
        {/* Home + Pilih */}
        <div className="tour-panel-in flex items-center gap-1.5">
          <Link
            href={homeHref}
            className={`flex size-11 shrink-0 items-center justify-center transition hover:bg-white/10 ${SURFACE_PILL}`}
            aria-label="Beranda"
          >
            <Home className="size-4" strokeWidth={2.25} />
          </Link>
          <button
            type="button"
            onClick={onPickStation}
            aria-label={`${pickLabel}, saat ini ${stationName}`}
            className={`flex h-11 min-w-0 flex-1 items-center gap-2 px-3 text-left text-sm font-semibold transition hover:bg-white/10 ${SURFACE_PILL}`}
          >
            <TrainFront className="size-4 shrink-0 opacity-90" />
            <span className="min-w-0 flex-1 truncate font-display"><span className="md:hidden">{locationBreadcrumb ? locationBreadcrumb.stationName : pickLabel}</span><span className="hidden md:inline">{pickLabel}</span></span>
            <ChevronDown className="size-4 shrink-0 opacity-70" strokeWidth={2.5} />
          </button>
        </div>

        {locationBreadcrumb ? (
          <nav aria-label="Lokasi tur" className="w-max max-w-[calc(100vw-1rem)] self-start rounded-lg bg-[#1c1c1e]/85 px-2.5 py-1.5 text-white backdrop-blur-md md:absolute md:top-2 md:right-2 md:flex md:min-h-11 md:max-w-[calc(100%-19rem)] md:items-center md:rounded-2xl md:border md:border-white/12 md:px-4 md:py-2">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed md:gap-x-3 md:text-sm">
              <li className="sr-only md:not-sr-only md:flex md:min-w-0 md:max-w-full md:items-center md:gap-2"><span className="shrink-0 text-white/75">Stasiun</span><strong className="min-w-0 break-words font-semibold">{locationBreadcrumb.stationName}</strong></li>
              {locationBreadcrumb.locationLabel && <li className="flex min-w-0 max-w-full items-center gap-2 md:gap-3"><ChevronRight aria-hidden="true" className="hidden size-3 shrink-0 text-white/45 md:block" /><span className="min-w-0 break-words text-white/85">{locationBreadcrumb.locationLabel}</span></li>}
              {locationBreadcrumb.sceneLabel && <li aria-current="location" className="flex min-w-0 max-w-full items-center gap-2 md:gap-3"><ChevronRight aria-hidden="true" className="size-3 shrink-0 text-white/45" /><span className="min-w-0 break-words font-semibold capitalize">{locationBreadcrumb.sceneLabel}</span></li>}
            </ol>
          </nav>
        ) : <section className={`flex items-center gap-2 px-2 py-1.5 ${SURFACE_PILL}`}>
          <span className={ICON_DISK}>
            <MapPin className="size-3.5 text-white" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium text-white/65">Lokasi Saat Ini</p>
            <p className="truncate font-display text-sm leading-tight font-bold text-white">
              {stationName}
            </p>
          </div>
        </section>}

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
