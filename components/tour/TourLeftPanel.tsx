"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { TourLanguageToggle, useTourLanguage } from "./TourLanguageProvider";
import { ChevronDown, ChevronRight, Home, MapPin, TrainFront } from "lucide-react";
import type { TourLocationBreadcrumb } from "@/lib/tour-location-breadcrumb";

type Props = {
  stationName: string;
  locationBreadcrumb?: TourLocationBreadcrumb;
  locationKind?: string;
  hideTourNameOnCompact?: boolean;
  onPickStation?: () => void;
  /** Default: / */
  homeHref?: string;
  clearUiControl?: ReactNode;
  tools?: ReactNode;
  railClassName?: string;
  /** Slot di bawah lokasi — mis. mini-map formasi gerbong */
  map?: ReactNode;
};

/** Void Portal glass — Experience chrome (token CSS) */
const wideHeaderSurface = "md:rounded-xl md:border md:[border-color:var(--hairline)] md:bg-[var(--tour-chrome-bg)] md:backdrop-blur-md";
const ICON_DISK = "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-panel";

/**
 * Panel kiri virtual tour — struktur mengikuti mockup Figma, warna dark glass.
 */
export default function TourLeftPanel({
  stationName,
  locationBreadcrumb,
  locationKind,
  hideTourNameOnCompact = false,
  onPickStation,
  homeHref = "/",
  clearUiControl,
  tools,
  railClassName = "",
  map,
}: Props) {
  const { t, content } = useTourLanguage();
  const pickStationLabel = t("Pilih Stasiun");
  const tourName = content(locationBreadcrumb?.stationName ?? stationName);
  const location = locationBreadcrumb?.locationParts.map(content).join(" · ");
  const scene = locationBreadcrumb?.sceneLabel;
  const showTourNameOnCompact = !hideTourNameOnCompact || !location;
  return (
    <div className="pointer-events-none absolute inset-0 z-[58]">
      <div className="grid min-w-0 items-start justify-items-start gap-2 p-2 md:grid-cols-[auto_minmax(0,1fr)] md:items-stretch md:gap-x-4">
        <div className="tour-chrome-pill w-full min-w-0 max-w-full rounded-xl min-[700px]:grid min-[700px]:grid-cols-[auto_minmax(0,1fr)] min-[700px]:items-stretch md:contents">
          <div className={`tour-panel-in pointer-events-auto flex max-w-full items-center px-1 ${wideHeaderSurface}`}>
            <Link
              href={homeHref}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
              aria-label={t("Beranda")}
            >
              <Home aria-hidden="true" className="size-4" strokeWidth={2.25} />
            </Link>
            {onPickStation ? (
              <button
                type="button"
                onClick={onPickStation}
                aria-label={t("{pick}, saat ini {station}", { pick: pickStationLabel, station: tourName })}
                className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-white md:flex-none"
              >
                <TrainFront aria-hidden="true" className="size-4 shrink-0 opacity-90" />
                <span className="min-w-0 truncate font-display">{pickStationLabel}</span>
                <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 opacity-70" strokeWidth={2.25} />
              </button>
            ) : (
              <span className="min-w-0 flex-1 truncate px-2 text-xs font-semibold text-ink/85 min-[700px]:hidden" title={tourName}>{tourName}</span>
            )}
            <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-white/15" />
            <TourLanguageToggle embedded />
          </div>

          {locationBreadcrumb ? (
            <nav aria-label={t("Lokasi tur")} className={`flex min-h-9 min-w-0 max-w-full items-center border-white/10 max-[700px]:border-t min-[700px]:max-md:border-l px-3.5 py-1.5 min-[700px]:justify-end md:min-h-11 md:justify-self-end ${wideHeaderSurface}`}>
              <ol className="flex min-w-0 items-center gap-1.5 text-xs leading-relaxed md:gap-2 md:text-sm">
                <li className={`min-w-0 items-center gap-1.5 ${showTourNameOnCompact ? "flex" : "hidden min-[700px]:flex"}`}>
                  {locationKind && <span className="hidden shrink-0 text-fog lg:inline">{t(locationKind)}</span>}
                  <strong className="truncate font-medium" title={tourName}>{tourName}</strong>
                </li>
                {location && (
                  <li className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                    <ChevronRight aria-hidden="true" className={`size-3 shrink-0 text-fog ${showTourNameOnCompact ? "" : "hidden min-[700px]:block"}`} />
                    <span className="truncate text-ink/85" title={location}>{location}</span>
                  </li>
                )}
                {scene && (
                  <li aria-current="location" className="flex min-w-0 max-w-[55%] shrink-0 items-center gap-1.5 sm:gap-2">
                    <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-fog" />
                    <span className="truncate font-semibold capitalize" title={content(scene)}>{content(scene)}</span>
                  </li>
                )}
              </ol>
            </nav>
          ) : <section className={`flex items-center gap-2 border-white/10 max-[700px]:border-t min-[700px]:max-md:border-l px-3 py-1.5 ${wideHeaderSurface}`}>
            <span className={ICON_DISK}>
              <MapPin className="size-3.5 text-ink" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-medium text-fog">{t("Lokasi Saat Ini")}</p>
              <p className="truncate font-display text-sm leading-tight font-bold text-ink">
                {stationName}
              </p>
            </div>
          </section>}
        </div>

        {map ? <div className="pointer-events-auto md:col-span-2">{map}</div> : null}
      </div>

      {/* Rail tools — vertikal di tengah kiri */}
      {(clearUiControl || tools) && (
        <div className={`pointer-events-auto absolute top-1/2 left-2 z-[1] flex -translate-y-1/2 flex-col items-start gap-2 sm:left-3 ${railClassName}`}>
          {clearUiControl}
          {tools}
        </div>
      )}
    </div>
  );
}
