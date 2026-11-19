"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useState } from "react";
import FloorplanImage from "./FloorplanImage";
import { X } from "lucide-react";
import type { CSSProperties, Ref } from "react";
import type { MinimapAsset, MinimapPoint, StationMinimapData } from "@/lib/station-minimap";
import { resolvePublicAssetUrl } from "@/lib/s3-utils";

export function MinimapDrawing({ asset, point, yaw, onImageLoad }: {
  asset: MinimapAsset;
  point?: Pick<MinimapPoint, "x" | "y"> & { yawOffset?: number };
  yaw: number;
  onImageLoad?: () => void;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const beamScale = Math.min(asset.width, asset.height) / 190;
  const src = resolvePublicAssetUrl(asset.url);
  return (
    <>
      <FloorplanImage key={src} src={src} name={asset.name} onLoad={() => {
        setLoadedSrc(src);
        onImageLoad?.();
      }} />
      {point && loadedSrc === src && (
        <svg aria-hidden="true" viewBox={`0 0 ${asset.width} ${asset.height}`}
          className="pointer-events-none absolute inset-0 size-full overflow-hidden">
          <g transform={`translate(${asset.width * point.x} ${asset.height * point.y}) scale(${beamScale})`}>
            {point.yawOffset !== undefined && (
              <g style={{
                transform: `rotate(calc(var(--minimap-yaw, ${yaw}deg) + ${point.yawOffset}deg))`,
                transformOrigin: "0 0",
              }}>
                <path d="M0 0 L-24 -33 Q0 -48 24 -33 Z" fill="#facc15" fillOpacity=".64"
                  stroke="#a16207" strokeWidth="1.5" strokeLinejoin="round" />
              </g>
            )}
            <circle r="5.5" fill="#facc15" stroke="#422006" strokeWidth="2" />
          </g>
        </svg>
      )}
    </>
  );
}

export default function StationMinimap({ data, sceneId, levelLabel, initialYaw, mapRef, onClose }: {
  data?: StationMinimapData;
  sceneId: string;
  levelLabel?: string;
  initialYaw: number;
  mapRef: Ref<HTMLDivElement>;
  onClose: () => void;
}) {
  const { t, content } = useTourLanguage();
  const point = data?.positions[sceneId];
  return (
    <section id="station-minimap" aria-label={t("Minimap stasiun")}
      className="tour-chrome-pill pointer-events-auto absolute right-2 top-24 z-[61] min-[700px]:top-[4.5rem] w-[min(20rem,calc(100vw-4rem))] overflow-hidden rounded-2xl p-2 shadow-xl md:right-3 md:w-[26rem]">
      <header className="flex items-center justify-between gap-3 pb-1 pl-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">{levelLabel ? content(levelLabel) : t("Denah stasiun")}</h2>
        <button type="button" aria-label={t("Tutup minimap")} onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white">
          <X className="size-4" />
        </button>
      </header>
      {data ? (
        <>
          <div key={sceneId} ref={mapRef} data-scene-id={sceneId}
            style={{ "--minimap-yaw": `${initialYaw}deg`, aspectRatio: data.asset.width / data.asset.height } as CSSProperties}
            className="relative overflow-hidden rounded-lg bg-white">
            <MinimapDrawing asset={data.asset} point={point} yaw={initialYaw} />
          </div>
          {!point && <p className="px-2 py-1.5 text-xs text-fog">{t("Posisi scene belum dipetakan.")}</p>}
        </>
      ) : <p className="px-2 pb-2 text-xs text-fog">{t("Denah lantai ini belum tersedia.")}</p>}
    </section>
  );
}
