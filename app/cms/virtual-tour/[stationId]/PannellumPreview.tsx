"use client";

import { useEffect, useRef } from "react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { HotspotItem } from "./PanoramaCanvas";

interface Props {
  panoramaUrl: string;
  hotspots: HotspotItem[];
  sceneName: string;
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

// ─── Helper: build a fully-custom hotspot button + tooltip ───────────────────
function buildHotspotElement(div: HTMLDivElement, isScene: boolean, label: string) {
  const color = isScene ? "#10b981" : "#f59e0b";
  const arrowSvg =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  const dotSvg =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="white" stroke-width="2"/></svg>';

  // Style the hotspot circle
  Object.assign(div.style, {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "3px solid rgba(255,255,255,0.9)",
    backgroundColor: color,
    cursor: "pointer",
    boxShadow: "0 3px 14px rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    overflow: "visible",
    animation: "lrt-hotspot-pulse 2.8s ease-in-out infinite",
  });
  div.innerHTML = isScene ? arrowSvg : dotSvg;

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.textContent = label;
  Object.assign(tooltip.style, {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15,23,42,0.95)",
    color: "#f1f5f9",
    padding: "5px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    display: "none",
    border: "1px solid rgba(255,255,255,0.15)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    zIndex: "10",
  });
  div.appendChild(tooltip);

  div.addEventListener("mouseenter", () => {
    tooltip.style.display = "block";
    div.style.transform = "scale(1.22)";
    div.style.boxShadow = "0 6px 22px rgba(0,0,0,0.65)";
    div.style.animation = "none";
  });
  div.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
    div.style.transform = "scale(1)";
    div.style.boxShadow = "0 3px 14px rgba(0,0,0,0.55)";
    div.style.animation = "lrt-hotspot-pulse 2.8s ease-in-out infinite";
  });
}

export function PannellumPreview({ panoramaUrl, hotspots, sceneName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !panoramaUrl) return;
    const isMounted = { current: true };

    async function init() {
      try {
        await loadPannellum();
        if (!isMounted.current || !containerRef.current) return;

        if (viewerRef.current) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }

        const hotSpots = hotspots.map((h) => {
          const isScene = h.type === "scene";
          const label = h.text;
          return {
            pitch: h.pitch,
            yaw: h.yaw,
            type: "custom",
            cssClass: isScene ? "lrt-scene-hotspot" : "lrt-space-hotspot",
            createTooltipFunc: (div: HTMLDivElement) => {
              buildHotspotElement(div, isScene, label);
            },
          };
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
        try {
          viewerRef.current.destroy();
        } catch {}
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
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: "#0f172a" }}
      />
      {/* Scene label overlay */}
      <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-700 pointer-events-none flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
        Preview — {sceneName}
      </div>
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-700 pointer-events-none">
        {hotspots.length} hotspot
      </div>
    </div>
  );
}
