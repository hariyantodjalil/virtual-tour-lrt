"use client";

import { useEffect, useRef, useState } from "react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { HotspotItem } from "@/lib/hotspot-types";
import { applyHotspotBaseStyle, attachHotspotTooltip } from "@/lib/pannellum-hotspot";
import InTourSpacePopup from "@/components/tour/InTourSpacePopup";
import InTourInfoPopup from "@/components/tour/InTourInfoPopup";

type CommercialSpace = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: "TERSEDIA" | "TERISI" | "MAINTENANCE";
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
};

type PreviewScene = {
  sceneId: string;
  title: string;
};

interface Props {
  panoramaUrl: string;
  hotspots: HotspotItem[];
  sceneName: string;
  scenes?: PreviewScene[];
  spaces?: CommercialSpace[];
  stationName?: string;
  onSceneNavigate?: (sceneId: string) => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pannellum: any;
  }
}

function loadPannellum(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.pannellum) { resolve(); return; }
    if (!document.getElementById("pannellum-css")) {
      const link = document.createElement("link");
      link.id = "pannellum-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById("pannellum-js")) {
      const script = document.createElement("script");
      script.id = "pannellum-js";
      script.src = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Gagal memuat Pannellum"));
      document.body.appendChild(script);
    } else {
      let attempts = 0;
      const check = setInterval(() => {
        if (window.pannellum) { clearInterval(check); resolve(); }
        else if (++attempts > 40) { clearInterval(check); reject(new Error("Pannellum timeout")); }
      }, 100);
    }
  });
}

export function PannellumPreview({
  panoramaUrl,
  hotspots,
  sceneName,
  scenes = [],
  spaces = [],
  stationName = "",
  onSceneNavigate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const onSceneNavigateRef = useRef(onSceneNavigate);

  const spacesRef = useRef(spaces);

  const [selectedSpace, setSelectedSpace] = useState<CommercialSpace | null>(null);
  const [infoPopup, setInfoPopup] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    onSceneNavigateRef.current = onSceneNavigate;
  }, [onSceneNavigate]);

  useEffect(() => {
    spacesRef.current = spaces;
  }, [spaces]);

  useEffect(() => {
    if (!containerRef.current || !panoramaUrl) return;
    const isMounted = { current: true };

    async function init() {
      try {
        await loadPannellum();
        if (!isMounted.current || !containerRef.current) return;

        if (viewerRef.current) {
          try { viewerRef.current.destroy(); } catch { /* ignore */ }
          viewerRef.current = null;
        }

        const hotSpots = hotspots.map((h) => {
          const hs: Record<string, unknown> = {
            pitch: h.pitch,
            yaw: h.yaw,
            type: "custom",
            cssClass: `lrt-${h.type}-hotspot`,
            createTooltipFunc: (div: HTMLDivElement) => {
              applyHotspotBaseStyle(div, { type: h.type, label: h.text, pulse: true });
              attachHotspotTooltip(div, h.text);
            },
          };

          if (h.type === "scene" && h.sceneId) {
            const sceneId = h.sceneId;
            hs.clickHandlerFunc = () => onSceneNavigateRef.current?.(sceneId);
          } else if (h.type === "space" && h.spaceCode) {
            const code = h.spaceCode;
            hs.clickHandlerFunc = () => {
              const space = spacesRef.current.find((s) => s.code === code);
              if (space) setSelectedSpace(space);
            };
          } else if (h.type === "info") {
            const title = h.text;
            const description = h.description ?? "";
            hs.clickHandlerFunc = () => setInfoPopup({ title, description });
          }

          return hs;
        });

        viewerRef.current = window.pannellum.viewer(containerRef.current, {
          type: "equirectangular",
          panorama: getS3ProxyUrl(panoramaUrl),
          autoLoad: true,
          autoRotate: -1.5,
          showControls: true,
          showFullscreenCtrl: false,
          showZoomCtrl: true,
          hfov: 100,
          minHfov: 50,
          maxHfov: 120,
          hotSpots,
        });
      } catch (e) {
        console.error("Pannellum preview error:", e);
      }
    }

    init();

    return () => {
      isMounted.current = false;
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
  }, [panoramaUrl, hotspots]);

  if (!panoramaUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500">
        <div className="text-5xl mb-3">🌐</div>
        <p className="text-sm">Upload panorama terlebih dahulu untuk melihat preview</p>
      </div>
    );
  }

  return (
    <div className="cms-vt-panorama relative h-full min-h-0 w-full overflow-hidden overscroll-none">
      <div ref={containerRef} className="absolute inset-0" style={{ background: "#0f172a" }} />

      <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-700 pointer-events-none flex items-center gap-1.5 z-10">
        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse inline-block" />
        Preview — {sceneName}
      </div>
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-700 pointer-events-none z-10">
        {hotspots.length} hotspot · klik untuk interaksi
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
