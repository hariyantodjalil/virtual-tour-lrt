"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Grid3X3, Info, Route, X } from "lucide-react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { HotspotItem } from "@/lib/hotspot-types";
import type { PrivacyBlurItem } from "@/lib/privacy-blur-types";
import type { PanoramaScene, TourLevelPublic } from "@/lib/tour-types";
import { setupHotspotElement, resolveSceneHotspotTitle } from "@/lib/pannellum-hotspot";
import {
  findSpaceStatus,
  type SpaceAvailabilityStatus,
} from "@/lib/space-availability";
import { PANNELLUM_HFOV, PANNELLUM_INTERACTION, PANNELLUM_PITCH_LIMITS } from "@/lib/pannellum-viewer-defaults";
import { formatNumber } from "@/lib/utils";
import { TourNavigationBar } from "@/components/tour/TourNavigationBar";
import InTourSpacePopup from "@/components/tour/InTourSpacePopup";
import InTourInfoPopup from "@/components/tour/InTourInfoPopup";

type CommercialSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: SpaceAvailabilityStatus;
  area: number;
  monthlyRent: number;
  deposit: number;
  floor: string;
  location: string;
  nearestExit: string | null;
  exposure: number;
  powerSupply: string | null;
  waterAccess: boolean;
  airConditioning: boolean;
  description: string | null;
  panoramaUrl?: string | null;
  tenantBrand?: string | null;
};

type PreviewScene = {
  sceneId: string;
  title: string;
};

interface Props {
  panoramaUrl: string;
  hotspots: HotspotItem[];
  privacyBlurs?: PrivacyBlurItem[];
  sceneId: string;
  sceneName: string;
  scenes?: PreviewScene[];
  levels?: TourLevelPublic[];
  spaces?: CommercialSpace[];
  stationName?: string;
  onSceneNavigate?: (sceneId: string) => void;
  initialView?: { yaw: number; pitch: number; hfov?: number } | null;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pannellum: any;
  }
}

function loadPannellum(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.pannellum) {
      resolve();
      return;
    }
    if (!document.getElementById("pannellum-css")) {
      const link = document.createElement("link");
      link.id = "pannellum-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/pannellum@2.5.7/build/pannellum.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById("pannellum-js")) {
      const script = document.createElement("script");
      script.id = "pannellum-js";
      script.src = "https://cdn.jsdelivr.net/npm/pannellum@2.5.7/build/pannellum.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Gagal memuat Pannellum"));
      document.body.appendChild(script);
    } else {
      let attempts = 0;
      const check = setInterval(() => {
        if (window.pannellum) {
          clearInterval(check);
          resolve();
        } else if (++attempts > 40) {
          clearInterval(check);
          reject(new Error("Pannellum timeout"));
        }
      }, 100);
    }
  });
}

export function PannellumPreview({
  panoramaUrl,
  hotspots,
  privacyBlurs = [],
  sceneId,
  sceneName,
  scenes = [],
  levels = [],
  spaces = [],
  stationName = "",
  onSceneNavigate,
  initialView = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const onSceneNavigateRef = useRef(onSceneNavigate);
  const spacesRef = useRef(spaces);
  const scenesRef = useRef(scenes);

  const [selectedSpace, setSelectedSpace] = useState<CommercialSpace | null>(null);
  const [infoPopup, setInfoPopup] = useState<{ title: string; description: string } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);

  const currentScene = scenes.find((scene) => scene.sceneId === sceneId) ?? scenes[0];
  const currentPlacement = findScenePlacement(levels, currentScene?.sceneId ?? "");
  const activeLevelId = currentPlacement?.level.id ?? levels[0]?.id ?? "";
  const activeAreaId = currentPlacement?.area?.id ?? levels[0]?.areas[0]?.id ?? null;
  const visibleSceneIds =
    currentPlacement?.area?.sceneIds ??
    currentPlacement?.level.sceneIds ??
    levels[0]?.areas[0]?.sceneIds ??
    levels[0]?.sceneIds ??
    scenes.map((scene) => scene.sceneId);
  const navScenes: PanoramaScene[] = scenes.map((scene) => ({
    id: scene.sceneId,
    title: scene.title,
    panoramaUrl: "",
    hotspots: [],
  }));
  const availableCount = spaces.filter((space) => space.status === "TERSEDIA").length;
  const occupiedCount = spaces.filter((space) => space.status === "TERISI").length;

  useEffect(() => {
    onSceneNavigateRef.current = onSceneNavigate;
  }, [onSceneNavigate]);

  useEffect(() => {
    spacesRef.current = spaces;
  }, [spaces]);

  useEffect(() => {
    scenesRef.current = scenes;
  }, [scenes]);

  useEffect(() => {
    if (!containerRef.current || !panoramaUrl) return;
    const isMounted = { current: true };

    async function init() {
      try {
        await loadPannellum();
        if (!isMounted.current || !containerRef.current) return;

        if (viewerRef.current) {
          try {
            viewerRef.current.destroy();
          } catch {
            /* ignore */
          }
          viewerRef.current = null;
        }

        const hotSpots = hotspots.map((h) => {
          let onClick: (() => void) | undefined;

          if (h.type === "scene" && h.sceneId) {
            const sceneId = h.sceneId;
            onClick = () => onSceneNavigateRef.current?.(sceneId);
          } else if (h.type === "space" && h.spaceCode) {
            const code = h.spaceCode;
            onClick = () => {
              const space = spacesRef.current.find((s) => s.code === code);
              if (space) setSelectedSpace(space);
            };
          } else if (h.type === "ad") {
            const code = h.spaceCode;
            const title = h.creativeTitle || h.text;
            const description = h.creativeUrl
              ? `Kreatif: ${h.creativeUrl}`
              : "Slot media iklan";
            onClick = () => {
              if (code) {
                const space = spacesRef.current.find((s) => s.code === code);
                if (space) {
                  setSelectedSpace(space);
                  return;
                }
              }
              setInfoPopup({ title, description });
            };
          } else if (h.type === "info") {
            const title = h.text;
            const description = h.description ?? "";
            onClick = () => setInfoPopup({ title, description });
          }

          return {
            pitch: h.pitch,
            yaw: h.yaw,
            type: "custom" as const,
            cssClass: `lrt-${h.type}-hotspot`,
            createTooltipFunc: (div: HTMLDivElement) => {
              const spaceStatus =
                h.type === "space" && h.spaceCode
                  ? findSpaceStatus(spacesRef.current, h.spaceCode)
                  : undefined;
              setupHotspotElement(div, {
                type: h.type,
                onClick,
                scale: h.scale,
                spaceStatus,
                facilityIcon: h.type === "info" ? h.facilityIcon : undefined,
                sceneTitle:
                  h.type === "scene"
                    ? resolveSceneHotspotTitle(h.sceneId, scenesRef.current, h.text)
                    : undefined,
                direction: h.type === "scene" ? h.direction : undefined,
              });
            },
          };
        });

        viewerRef.current = window.pannellum.viewer(containerRef.current, {
          type: "equirectangular",
          panorama: getS3ProxyUrl(panoramaUrl),
          autoLoad: true,
          autoRotate: 0,
          showControls: true,
          showFullscreenCtrl: false,
          showZoomCtrl: true,
          ...PANNELLUM_HFOV,
          ...(initialView
            ? {
                yaw: initialView.yaw,
                pitch: initialView.pitch,
                hfov: initialView.hfov ?? PANNELLUM_HFOV.hfov,
              }
            : {}),
          ...PANNELLUM_PITCH_LIMITS,
          ...PANNELLUM_INTERACTION,
          hotSpots: hotSpots,
        });
      } catch (e) {
        console.error("Pannellum preview error:", e);
      }
    }

    init();

    return () => {
      isMounted.current = false;
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch {
          /* ignore */
        }
        viewerRef.current = null;
      }
    };
  }, [panoramaUrl, hotspots, scenes, initialView]);

  if (!panoramaUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500">
        <div className="text-5xl mb-3">360</div>
        <p className="text-sm">Upload panorama terlebih dahulu untuk melihat preview</p>
      </div>
    );
  }

  return (
    <div className="cms-vt-panorama relative h-full min-h-0 w-full overflow-hidden overscroll-none">
      <div ref={containerRef} className="absolute inset-0" style={{ background: "#0f172a" }} />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_bottom,rgba(0,0,0,.42)_0%,transparent_30%,transparent_66%,rgba(0,0,0,.52)_100%)]" />

      {levels.length > 0 && currentScene && (
        <TourNavigationBar
          levels={levels}
          scenes={navScenes}
          activeLevelId={activeLevelId}
          activeAreaId={activeAreaId}
          activeSceneId={currentScene.sceneId}
          visibleSceneIds={visibleSceneIds}
          onSelectLevel={(levelId) => {
            const level = levels.find((l) => l.id === levelId);
            const target = level?.areas[0]?.sceneIds[0] ?? level?.sceneIds[0];
            if (target) onSceneNavigateRef.current?.(target);
          }}
          onSelectArea={(areaId) => {
            const area = levels.flatMap((level) => level.areas).find((a) => a.id === areaId);
            const target = area?.sceneIds[0];
            if (target) onSceneNavigateRef.current?.(target);
          }}
          onSelectScene={(sceneId) => onSceneNavigateRef.current?.(sceneId)}
        />
      )}

      <div className="pointer-events-none absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setInfoOpen((v) => !v);
            setRouteOpen(false);
            setUnitsOpen(false);
          }}
          className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-md transition-all ${
            infoOpen ? "border-white/25 bg-white text-[#1B3A6B]" : "border-white/15 bg-black/55 text-white hover:bg-black/70"
          }`}
          title="Info stasiun"
        >
          <Info className="h-5 w-5" />
        </button>
        {scenes.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setRouteOpen((v) => !v);
              setInfoOpen(false);
              setUnitsOpen(false);
            }}
            className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-md transition-all ${
              routeOpen ? "border-white/25 bg-white text-[#1B3A6B]" : "border-white/15 bg-black/55 text-white hover:bg-black/70"
            }`}
            title="Daftar scene"
          >
            <Route className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setUnitsOpen((v) => !v);
            setInfoOpen(false);
            setRouteOpen(false);
          }}
          className={`pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-md transition-all ${
            unitsOpen ? "border-white/25 bg-white text-[#1B3A6B]" : "border-white/15 bg-black/55 text-white hover:bg-black/70"
          }`}
          title="Daftar unit"
        >
          <Grid3X3 className="h-5 w-5" />
          {availableCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E2D] text-[9px] font-black text-white">
              {availableCount}
            </span>
          )}
        </button>
      </div>

      {infoOpen && !selectedSpace && (
        <PreviewPanel title={stationName || "Info Stasiun"} onClose={() => setInfoOpen(false)}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric value={availableCount} label="Tersedia" tone="text-emerald-300" />
            <Metric value={occupiedCount} label="Terisi" tone="text-red-300" />
            <Metric value={spaces.length} label="Total" tone="text-white" />
          </div>
          <div className="rounded-xl bg-white/8 p-3 text-xs text-white/65">
            Preview ini memakai navigasi publik untuk validasi alur scene, tab level, area, hotspot, dan blur privasi.
          </div>
        </PreviewPanel>
      )}

      {routeOpen && !selectedSpace && (
        <PreviewPanel title="Daftar Scene" onClose={() => setRouteOpen(false)}>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {scenes.map((scene, index) => (
              <button
                key={scene.sceneId}
                type="button"
                onClick={() => onSceneNavigateRef.current?.(scene.sceneId)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                  scene.sceneId === currentScene?.sceneId
                    ? "bg-white text-[#1B3A6B]"
                    : "bg-white/8 text-white/75 hover:bg-white/14 hover:text-white"
                }`}
              >
                <span className="font-mono text-[10px] opacity-60">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{scene.title}</span>
              </button>
            ))}
          </div>
        </PreviewPanel>
      )}

      {unitsOpen && !selectedSpace && (
        <PreviewPanel title="Unit Komersial" onClose={() => setUnitsOpen(false)}>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                onClick={() => setSelectedSpace(space)}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/8 px-3 py-2 text-left text-xs text-white/75 transition-colors hover:bg-white/14 hover:text-white"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-white">{space.code}</span>
                  <span className="block truncate text-white/50">{space.name}</span>
                </span>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                  {formatNumber(Math.round(space.exposure))}
                </span>
              </button>
            ))}
          </div>
        </PreviewPanel>
      )}

      <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-700 pointer-events-none flex items-center gap-1.5 z-20">
        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
        Preview - {sceneName}
      </div>
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-700 pointer-events-none z-20">
        {hotspots.length} hotspot
        {privacyBlurs.length > 0 ? ` · ${privacyBlurs.length} blur (bake)` : ""} · klik untuk interaksi
      </div>

      {selectedSpace && (
        <InTourSpacePopup
          space={selectedSpace}
          stationName={stationName}
          onClose={() => setSelectedSpace(null)}
        />
      )}

      {infoPopup && (
        <InTourInfoPopup
          title={infoPopup.title}
          description={infoPopup.description}
          onClose={() => setInfoPopup(null)}
        />
      )}
    </div>
  );
}

function findScenePlacement(levels: TourLevelPublic[], sceneId: string) {
  for (const level of levels) {
    for (const area of level.areas) {
      if (area.sceneIds.includes(sceneId)) return { level, area };
    }
    if (level.sceneIds.includes(sceneId)) return { level, area: null };
  }
  return null;
}

function PreviewPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-auto absolute left-16 top-1/2 z-30 w-72 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0d1f3c]/90 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="min-w-0 truncate text-sm font-black">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-full p-1 transition-colors hover:bg-white/10">
          <X className="h-4 w-4 text-white/60" />
        </button>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-xl bg-white/8 py-2.5">
      <p className={`text-base font-black ${tone}`}>{value}</p>
      <p className="text-[10px] text-white/55">{label}</p>
    </div>
  );
}
