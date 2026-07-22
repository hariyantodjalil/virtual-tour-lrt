"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Navigation, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PanoramaScene } from "@/lib/tour-types";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { findSpaceStatus } from "@/lib/space-availability";
import {
  buildPannellumTourConfig,
  panoramaUrlForScene,
  preloadLinkedScenes,
  preloadPanoramaUrl,
  preloadInitialPanorama,
} from "@/lib/pannellum-tour-config";
import {
  diveIntoScene,
  softCrossfadeScene,
  type DiveOverlayState,
} from "@/lib/pannellum-tour-dive";
import { bindPrivacyBlursInContainer } from "@/lib/pannellum-privacy-blur";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pannellum: any;
  }
}

const ZERO_OVERLAY: DiveOverlayState = { blur: 0, fade: 0, vignette: 0 };

type SpaceStatusRef = {
  code: string;
  status: SpaceAvailabilityStatus;
};

type Props = {
  scenes: PanoramaScene[];
  spaces?: SpaceStatusRef[];
  onSpaceClick?: (spaceCode: string) => void;
  onAdClick?: (payload: import("@/lib/pannellum-tour-config").AdHotspotPayload) => void;
  onInfoClick?: (title: string, description: string) => void;
  onSceneChange?: (sceneId: string) => void;
  initialScene?: string;
  selectedSceneId?: string;
  focusCamera?: { yaw: number; pitch: number; hfov?: number } | null;
  focusToken?: number;
  stationName: string;
  hideSceneBar?: boolean;
};

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
      script.onerror = () => reject(new Error("Gagal memuat Pannellum dari CDN"));
      document.body.appendChild(script);
    } else {
      let attempts = 0;
      const check = setInterval(() => {
        if (window.pannellum) { clearInterval(check); resolve(); }
        if (++attempts > 50) { clearInterval(check); reject(new Error("Timeout menunggu Pannellum")); }
      }, 100);
    }
  });
}

function startViewerAutoRotate(viewer: unknown, speed = -2) {
  const api = viewer as {
    startAutoRotate?: (speed?: number) => void;
    setAutoRotate?: (speed: number) => void;
  };
  if (typeof api.startAutoRotate === "function") {
    api.startAutoRotate(speed);
    return true;
  }
  if (typeof api.setAutoRotate === "function") {
    api.setAutoRotate(speed);
    return true;
  }
  return false;
}

function stopViewerAutoRotate(viewer: unknown) {
  const api = viewer as { stopAutoRotate?: () => void };
  if (typeof api.stopAutoRotate === "function") {
    api.stopAutoRotate();
  }
}

export default function VirtualTourViewer({
  scenes,
  spaces = [],
  onSpaceClick,
  onAdClick,
  onInfoClick,
  onSceneChange,
  initialScene,
  selectedSceneId,
  focusCamera,
  focusToken = 0,
  hideSceneBar = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const onSpaceClickRef = useRef(onSpaceClick);
  const onAdClickRef = useRef(onAdClick);
  const onInfoClickRef = useRef(onInfoClick);
  const onSceneChangeRef = useRef(onSceneChange);
  const scenesRef = useRef(scenes);
  const spacesRef = useRef(spaces);
  const divingRef = useRef(false);
  const externalNavRef = useRef(false);
  const overlayRef = useRef<DiveOverlayState>(ZERO_OVERLAY);

  const [panoramaVisible, setPanoramaVisible] = useState(false);
  const [overlay, setOverlay] = useState<DiveOverlayState>(ZERO_OVERLAY);
  const [error, setError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [internalSceneId, setInternalSceneId] = useState(initialScene ?? scenes[0]?.id);
  const [autoRotate, setAutoRotate] = useState(false);
  const isMounted = useRef(true);

  const focusCameraRef = useRef(focusCamera);
  const focusTokenRef = useRef(focusToken);

  const activeSceneId = selectedSceneId ?? internalSceneId ?? scenes[0]?.id;
  const activeSceneIdRef = useRef(activeSceneId);
  const currentSceneIdx = Math.max(0, scenes.findIndex((scene) => scene.id === activeSceneId));
  const scenesSig = useMemo(() => scenes.map((s) => s.id).join("|"), [scenes]);

  useEffect(() => {
    onSpaceClickRef.current = onSpaceClick;
    onAdClickRef.current = onAdClick;
    onInfoClickRef.current = onInfoClick;
    onSceneChangeRef.current = onSceneChange;
    scenesRef.current = scenes;
    spacesRef.current = spaces;
    focusCameraRef.current = focusCamera;
    focusTokenRef.current = focusToken;
    activeSceneIdRef.current = activeSceneId;
  });

  const overlayController = useMemo(
    () => ({
      update: (state: DiveOverlayState) => {
        overlayRef.current = state;
        if (isMounted.current) setOverlay(state);
      },
      reset: () => {
        overlayRef.current = ZERO_OVERLAY;
        if (isMounted.current) setOverlay(ZERO_OVERLAY);
      },
    }),
    []
  );

  const resumeDefaultCamera = useCallback((viewer: typeof viewerRef.current) => {
    if (!viewer || divingRef.current) return;
    try {
      stopViewerAutoRotate(viewer);
      setAutoRotate(false);
    } catch {
      /* ignore */
    }
  }, []);

  const applyCameraFocus = useCallback((viewer: typeof viewerRef.current) => {
    const target = focusCameraRef.current;
    const token = focusTokenRef.current;
    if (!target || !token || !viewer) return;
    try {
      stopViewerAutoRotate(viewer);
      setAutoRotate(false);
      viewer.lookAt(target.pitch, target.yaw, target.hfov ?? 82, 900);
    } catch {
      /* ignore */
    }
  }, []);

  const ensureSceneReady = useCallback(
    (sceneId: string) => preloadPanoramaUrl(panoramaUrlForScene(scenesRef.current, sceneId)),
    []
  );

  const preloadSceneById = useCallback((sceneId: string) => {
    void ensureSceneReady(sceneId);
  }, [ensureSceneReady]);

  const handleSceneHotspotClick = useCallback(
    async (targetSceneId: string, pitch: number, yaw: number) => {
      const viewer = viewerRef.current;
      if (!viewer || divingRef.current) return;

      divingRef.current = true;
      externalNavRef.current = false;

      const transitionOpts = { ensureReady: () => ensureSceneReady(targetSceneId) };

      try {
        await diveIntoScene(
          viewer,
          targetSceneId,
          pitch,
          yaw,
          overlayController,
          transitionOpts,
          (sceneId) => {
            setInternalSceneId(sceneId);
            onSceneChangeRef.current?.(sceneId);
            preloadLinkedScenes(scenesRef.current, sceneId);
          }
        );
      } catch (e) {
        console.error("Dive transition error:", e);
        overlayController.reset();
        try {
          await ensureSceneReady(targetSceneId);
          viewer.loadScene(targetSceneId);
          setInternalSceneId(targetSceneId);
          onSceneChangeRef.current?.(targetSceneId);
        } catch {
          /* ignore */
        }
      } finally {
        divingRef.current = false;
      }
    },
    [overlayController, ensureSceneReady]
  );

  const handleSceneHotspotRef = useRef(handleSceneHotspotClick);

  useEffect(() => {
    handleSceneHotspotRef.current = handleSceneHotspotClick;
  });

  const initTourViewer = useCallback(async () => {
    const currentScenes = scenesRef.current;
    if (!containerRef.current || currentScenes.length === 0) return;

    if (viewerRef.current) {
      try { viewerRef.current.destroy(); } catch { /* ignore */ }
      viewerRef.current = null;
    }
    containerRef.current.innerHTML = "";

    setPanoramaVisible(false);
    setViewerReady(false);
    setError(null);
    overlayController.reset();
    preloadInitialPanorama(currentScenes, activeSceneIdRef.current);

    try {
      await loadPannellum();
      if (!isMounted.current || !containerRef.current) return;

      const firstId = activeSceneIdRef.current ?? currentScenes[0]?.id;
      const config = buildPannellumTourConfig(currentScenes, firstId, {
        onSceneHotspot: (id, pitch, yaw) => handleSceneHotspotRef.current(id, pitch, yaw),
        onScenePreload: (id) => preloadSceneById(id),
        onSpaceClick: (code) => onSpaceClickRef.current?.(code),
        onAdClick: (payload) => onAdClickRef.current?.(payload),
        onInfoClick: (title, desc) => onInfoClickRef.current?.(title, desc),
        getSpaceStatus: (code) => findSpaceStatus(spacesRef.current, code),
      });

      const viewer = window.pannellum.viewer(containerRef.current, config);

      viewer.on("load", () => {
        if (!isMounted.current) return;
        setViewerReady(true);
        requestAnimationFrame(() => setPanoramaVisible(true));
        requestAnimationFrame(() => {
          bindPrivacyBlursInContainer(viewer, containerRef.current);
        });
        try {
          const sceneId = viewer.getScene?.();
          if (sceneId) preloadLinkedScenes(scenesRef.current, sceneId);
        } catch {
          /* ignore */
        }
        if (focusCameraRef.current && focusTokenRef.current) {
          applyCameraFocus(viewer);
        }
      });

      viewer.on("error", (err: string) => {
        console.error("Pannellum error:", err);
        if (isMounted.current) {
          setError("Gagal memuat panorama. Periksa koneksi internet.");
        }
      });

      viewerRef.current = viewer;
    } catch (e) {
      console.error("Viewer init error:", e);
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : "Gagal menginisialisasi viewer 360°");
      }
    }
  }, [applyCameraFocus, overlayController, preloadSceneById]);

  useEffect(() => {
    isMounted.current = true;
    initTourViewer();
    return () => {
      isMounted.current = false;
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
  }, [initTourViewer, scenesSig]);

  // Navigasi eksternal (tab level/area) — crossfade + blur ringan
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady || divingRef.current) return;

    try {
      const current = viewer.getScene?.();
      if (current && current !== activeSceneId) {
        if (externalNavRef.current) return;
        externalNavRef.current = true;
        divingRef.current = true;

        softCrossfadeScene(viewer, activeSceneId, overlayController, {
          ensureReady: () => ensureSceneReady(activeSceneId),
        })
          .catch(() => {
            try { viewer.loadScene(activeSceneId); } catch { /* ignore */ }
          })
          .finally(() => {
            divingRef.current = false;
            externalNavRef.current = false;
            setInternalSceneId(activeSceneId);
          });
      }
    } catch {
      /* ignore */
    }
  }, [activeSceneId, viewerReady, overlayController, ensureSceneReady]);

  useEffect(() => {
    if (!viewerRef.current || !viewerReady || divingRef.current) return;
    if (focusCamera && focusToken) {
      applyCameraFocus(viewerRef.current);
    } else {
      resumeDefaultCamera(viewerRef.current);
    }
  }, [focusToken, focusCamera, viewerReady, applyCameraFocus, resumeDefaultCamera]);

  const switchScene = useCallback(
    (idx: number) => {
      const scene = scenesRef.current[idx];
      if (!scene || divingRef.current) return;
      onSceneChangeRef.current?.(scene.id);
    },
    []
  );

  const toggleAutoRotate = () => {
    if (!viewerRef.current) return;
    try {
      if (autoRotate) {
        stopViewerAutoRotate(viewerRef.current);
        setAutoRotate(false);
        return;
      }
      setAutoRotate(startViewerAutoRotate(viewerRef.current, -2));
    } catch {
      setAutoRotate(false);
    }
  };

  return (
    <div className="lrt-vt-viewer relative h-full w-full overflow-hidden bg-[#0a0f18]">
      <div
        className={`lrt-vt-panorama-wrap absolute inset-0 transition-opacity duration-700 ease-out ${
          panoramaVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          filter: overlay.blur > 0 ? `blur(${overlay.blur}px)` : undefined,
          transform: overlay.vignette > 0 ? `scale(${1 + overlay.vignette * 0.06})` : undefined,
          transition: "opacity 700ms ease-out, filter 80ms linear, transform 80ms linear",
        }}
      >
        <div ref={containerRef} className="absolute inset-0" />
      </div>

      {/* Fade putih + vignette — sinkron dengan crossfade Pannellum */}
      <div
        className="pointer-events-none absolute inset-0 z-[14]"
        style={{
          opacity: overlay.fade,
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 35%, rgba(0,0,0,${0.25 + overlay.vignette * 0.5}) 100%)`,
          transition: "opacity 60ms linear",
        }}
        aria-hidden
      />

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-20 gap-4 p-6">
          <div className="text-center">
            <p className="text-white font-semibold mb-2">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => initTourViewer()}
              className="text-white border-white/30 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Coba Lagi
            </Button>
          </div>
        </div>
      )}

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

      {panoramaVisible && !error && (
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

      <style>{`
        .pnlm-container { background: #0a0f18 !important; }
        .lrt-vt-viewer .pnlm-load-box,
        .lrt-vt-viewer .pnlm-lbox,
        .lrt-vt-viewer .pnlm-loading,
        .lrt-vt-viewer .pnlm-load-button {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `}</style>
    </div>
  );
}
