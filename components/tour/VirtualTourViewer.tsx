"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Navigation, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PanoramaScene } from "@/lib/tour-types";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { applyHotspotBaseStyle, attachHotspotTooltip } from "@/lib/pannellum-hotspot";
import type { HotspotType } from "@/lib/hotspot-types";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pannellum: any;
  }
}

type Props = {
  scenes: PanoramaScene[];
  onSpaceClick?: (spaceCode: string) => void;
  onInfoClick?: (title: string, description: string) => void;
  onSceneChange?: (sceneId: string) => void;
  initialScene?: string;
  selectedSceneId?: string;
  stationName: string;
  /** Sembunyikan tab level bawah saat drawer/popup unit terbuka */
  hideSceneBar?: boolean;
};

function loadPannellum(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.pannellum) { resolve(); return; }

    // CSS
    if (!document.getElementById("pannellum-css")) {
      const link = document.createElement("link");
      link.id = "pannellum-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css";
      document.head.appendChild(link);
    }

    // JS
    if (!document.getElementById("pannellum-js")) {
      const script = document.createElement("script");
      script.id = "pannellum-js";
      script.src = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Gagal memuat Pannellum dari CDN"));
      document.body.appendChild(script);
    } else {
      // Script sudah ada di DOM, tunggu sampai pannellum tersedia
      let attempts = 0;
      const check = setInterval(() => {
        if (window.pannellum) { clearInterval(check); resolve(); }
        if (++attempts > 50) { clearInterval(check); reject(new Error("Timeout menunggu Pannellum")); }
      }, 100);
    }
  });
}

// ─── Shared: custom hotspot visual builder ────────────────────────────────
function buildHotspotElement(div: HTMLDivElement, hotspotType: HotspotType, label: string) {
  applyHotspotBaseStyle(div, { type: hotspotType, label, pulse: true });
  attachHotspotTooltip(div, label);
}

export default function VirtualTourViewer({
  scenes, onSpaceClick, onInfoClick, onSceneChange, initialScene, selectedSceneId, stationName, hideSceneBar = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalSceneId, setInternalSceneId] = useState(initialScene ?? scenes[0]?.id);
  const [autoRotate, setAutoRotate] = useState(false);
  const isMounted = useRef(true);

  const activeSceneId = selectedSceneId ?? internalSceneId ?? scenes[0]?.id;
  const currentSceneIdx = Math.max(0, scenes.findIndex((scene) => scene.id === activeSceneId));
  const currentScene = scenes[currentSceneIdx];

  const switchScene = useCallback((idx: number) => {
    const scene = scenes[idx];
    if (!scene) return;
    setInternalSceneId(scene.id);
    onSceneChange?.(scene.id);
  }, [onSceneChange, scenes]);

  const initViewer = useCallback(async () => {
    if (!containerRef.current || !currentScene) return;

    // Bersihkan viewer lama
    if (viewerRef.current) {
      try { viewerRef.current.destroy(); } catch { /* ignore */ }
      viewerRef.current = null;
    }

    // Bersihkan isi container
    containerRef.current.innerHTML = "";

    setIsLoading(true);
    setError(null);

    try {
      await loadPannellum();
      if (!isMounted.current || !containerRef.current) return;

      const hotSpots = currentScene.hotspots.map((h) => {
        const label = h.text;

        const hs: Record<string, unknown> = {
          pitch: h.pitch,
          yaw: h.yaw,
          type: "custom",
          cssClass: `lrt-${h.type}-hotspot`,
          createTooltipFunc: (div: HTMLDivElement) => {
            buildHotspotElement(div, h.type, label);
          },
        };

        if (h.type === "scene" && h.sceneId) {
          const sceneId = h.sceneId;
          hs.clickHandlerFunc = () => {
            const idx = scenes.findIndex((scene) => scene.id === sceneId);
            if (idx >= 0) switchScene(idx);
          };
        } else if (h.type === "space" && onSpaceClick && h.spaceCode) {
          const code = h.spaceCode;
          hs.clickHandlerFunc = () => onSpaceClick(code);
        } else if (h.type === "info" && onInfoClick) {
          const title = h.text;
          const description = h.description ?? "";
          hs.clickHandlerFunc = () => onInfoClick(title, description);
        }
        return hs;
      });

      const viewer = window.pannellum.viewer(containerRef.current, {
        type: "equirectangular",
        panorama: getS3ProxyUrl(currentScene.panoramaUrl),
        autoLoad: true,
        autoRotate: -2,
        showControls: false,
        showFullscreenCtrl: false,
        hfov: 100,
        minHfov: 50,
        maxHfov: 120,
        hotSpots,
      });

      viewer.on("load", () => {
        if (isMounted.current) setIsLoading(false);
      });

      viewer.on("error", (err: string) => {
        console.error("Pannellum error:", err);
        if (isMounted.current) {
          setError("Gagal memuat panorama. Periksa koneksi internet.");
          setIsLoading(false);
        }
      });

      viewerRef.current = viewer;

      // Fallback timeout 10 detik
      setTimeout(() => {
        if (isMounted.current) setIsLoading(false);
      }, 10000);

    } catch (e) {
      console.error("Viewer init error:", e);
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : "Gagal menginisialisasi viewer 360°");
        setIsLoading(false);
      }
    }
  }, [currentScene, onSpaceClick, onInfoClick, scenes, switchScene]);

  useEffect(() => {
    isMounted.current = true;
    initViewer();
    return () => {
      isMounted.current = false;
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
  }, [initViewer]);

  const toggleAutoRotate = () => {
    if (!viewerRef.current) return;
    if (autoRotate) {
      viewerRef.current.stopAutoRotate();
    } else {
      viewerRef.current.setAutoRotate(-2);
    }
    setAutoRotate(!autoRotate);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-900">
      {/* Pannellum container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1B3A6B] to-black z-20 pointer-events-none">
          <div className="mb-4">
            <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-[#E31E2D] animate-spin" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">Memuat Virtual Tour</p>
          <p className="text-xs text-white/60">{stationName} · {currentScene?.title}</p>
          <div className="mt-6 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-20 gap-4 p-6">
          <div className="text-center">
            <p className="text-white font-semibold mb-2">{error}</p>
            <p className="text-white/50 text-sm mb-4">
              Panorama: {currentScene?.title}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => initViewer()}
              className="text-white border-white/30 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Coba Lagi
            </Button>
          </div>
        </div>
      )}

      {/* Scene selector */}
      {!error && scenes.length > 1 && !hideSceneBar && (
        <div className="absolute bottom-4 left-1/2 z-10 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center justify-center gap-2">
          <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/15 bg-black/65 px-3 py-2 shadow-2xl backdrop-blur-md">
            {scenes.map((scene, idx) => (
              <button
                key={scene.id}
                onClick={() => switchScene(idx)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  currentSceneIdx === idx
                    ? "bg-[#E31E2D] text-white shadow-md"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {scene.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      {!error && !isLoading && (
        <div className="absolute right-4 top-4 z-10">
          <button
            onClick={toggleAutoRotate}
            className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              autoRotate ? "bg-[#E31E2D] text-white" : "bg-black/50 text-white hover:bg-black/70"
            }`}
            title="Auto Putar"
          >
            <Navigation className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pannellum container background — styling hotspot kini sepenuhnya via buildHotspotElement */}
      <style>{`
        .pnlm-container { background: #111827 !important; }
      `}</style>
    </div>
  );
}
