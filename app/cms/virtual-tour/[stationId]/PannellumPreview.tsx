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

        const hotSpots = hotspots.map((h) => ({
          pitch: h.pitch,
          yaw: h.yaw,
          type: "custom",
          text: h.text,
          cssClass: h.type === "scene" ? "lrt-scene-hotspot" : "lrt-space-hotspot",
        }));

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
