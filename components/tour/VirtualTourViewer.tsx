"use client";

import { useTourLanguage } from "@/components/tour/TourLanguageProvider";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Navigation, RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PanoramaScene, SceneInitialView } from "@/lib/tour-types";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { findSpaceStatus } from "@/lib/space-availability";
import {
  buildPannellumTourConfig,
  buildPannellumSceneConfig,
  preloadLinkedScenes,
  preloadPanoramaUrls,
  scenePreviewUrls,
  preloadInitialPanorama,
  schedulePanoramaIntent,
} from "@/lib/pannellum-tour-config";
import {
  diveIntoScene,
  softCrossfadeScene,
  type DiveOverlayState,
} from "@/lib/pannellum-tour-dive";
import { bindPrivacyBlursInContainer } from "@/lib/pannellum-privacy-blur";
import { SpatialOverlay } from "@/components/tour/spatial/SpatialOverlay";
import { isSpatialHotspotEnabled } from "@/lib/spatial-feature";
import type { SpatialEntity } from "@/lib/spatial/types";
import { runSpatialAction } from "@/lib/spatial/actions";
import type { SpaceHotspotTarget } from "@/lib/space-hotspot-locate";
import { resolveSceneEntryView } from "@/lib/scene-entry-view";
import type { SpaceHotspotMarker } from "@/lib/pannellum-hotspot";
import { getAutomaticPanoramaQuality, observePanoramaNetwork, recordPanoramaTileFailure } from "@/lib/panorama-quality";
import type { PanoramaQuality } from "@/lib/panorama-quality";
import { selectQualityMultiRes } from "@/lib/panorama-quality-profile";

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
  onSpaceClick?: (spaceCode: string, target?: SpaceHotspotTarget) => void;
  onAdClick?: (payload: import("@/lib/pannellum-tour-config").AdHotspotPayload) => void;
  onInfoClick?: (title: string, description: string) => void;
  onSceneChange?: (sceneId: string) => void;
  onViewYawChange?: (yaw: number, sceneId: string) => void;
  initialScene?: string;
  selectedSceneId?: string;
  focusCamera?: { yaw: number; pitch: number; hfov?: number } | null;
  focusToken?: number;
  stationName: string;
  hideSceneBar?: boolean;
  spaceMarker?: SpaceHotspotMarker;
  /** Undefined keeps the standard control; null hides it until a custom slot mounts. */
  autoRotateControlContainer?: HTMLElement | null;
  /** Tone chrome overlay (auto-rotate / scene bar) — maroon mengikuti Void Portal */
  chromeTone?: "default" | "maroon";
};

function loadPannellum(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.pannellum) { resolve(); return; }

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
  onViewYawChange,
  initialScene,
  selectedSceneId,
  focusCamera,
  focusToken = 0,
  hideSceneBar = false,
  spaceMarker = "info-pin",
  autoRotateControlContainer,
  chromeTone = "default",
}: Props) {
  const { t, content } = useTourLanguage();
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
  /** Epoch init — cegah race double-mount (Strict Mode / remount) yang meninggalkan hotspot orphan. */
  const initEpochRef = useRef(0);
  const prepareSceneRef = useRef<((sceneId: string, width: number, quality: PanoramaQuality) => void) | null>(null);

  const [panoramaVisible, setPanoramaVisible] = useState(false);
  const [overlay, setOverlay] = useState<DiveOverlayState>(ZERO_OVERLAY);
  const [error, setError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [internalSceneId, setInternalSceneId] = useState(initialScene ?? scenes[0]?.id);
  const [autoRotate, setAutoRotate] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewerForOverlay, setViewerForOverlay] = useState<any>(null);
  useEffect(() => {
    if (!viewerReady || !onViewYawChange) return;
    let frame = 0;
    let previousSceneId: string | undefined;
    let previousYaw: number | undefined;
    function update() {
      const sceneId = viewerRef.current?.getScene?.();
      const yaw = viewerRef.current?.getYaw?.();
      if (typeof yaw === "number" && Number.isFinite(yaw) && typeof sceneId === "string" &&
        (sceneId !== previousSceneId || yaw !== previousYaw)) {
        onViewYawChange?.(yaw, sceneId);
        previousSceneId = sceneId;
        previousYaw = yaw;
      }
      frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [onViewYawChange, viewerReady, selectedSceneId]);

  const isMounted = useRef(true);
  const spatialEnabled = isSpatialHotspotEnabled();

  const focusCameraRef = useRef(focusCamera);
  const focusTokenRef = useRef(focusToken);

  const activeSceneId = selectedSceneId ?? internalSceneId ?? scenes[0]?.id;
  const activeSceneIdRef = useRef(activeSceneId);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
    const container = containerRef.current;
    if (!viewerReady || !container) return;
    for (const [selector, label] of [
      [".pnlm-zoom-in", "Mendekat"],
      [".pnlm-zoom-out", "Menjauh"],
      [".pnlm-fullscreen-toggle-button", "Layar penuh"],
    ]) {
      const control = container.querySelector(selector);
      control?.setAttribute("title", t(label));
      control?.setAttribute("aria-label", t(label));
    }
    container.querySelectorAll<HTMLElement>("[data-tour-text]").forEach(element => {
      if (element.dataset.tourText) element.setAttribute("aria-label", content(element.dataset.tourText));
    });
  }, [t, content, viewerReady, activeSceneId]);
  const currentSceneIdx = Math.max(0, scenes.findIndex((scene) => scene.id === activeSceneId));
  const scenesSig = useMemo(() => scenes.map((s) => s.id).join("|"), [scenes]);
  const activeSpatialEntities: SpatialEntity[] = useMemo(() => {
    if (!spatialEnabled) return [];
    const scene = scenes.find((s) => s.id === activeSceneId);
    return (scene?.spatialEntities ?? []).filter((e) => e.enabled);
  }, [scenes, activeSceneId, spatialEnabled]);

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
      viewer.lookAt(target.pitch, target.yaw, target.hfov ?? viewer.getHfov(), 320);
    } catch {
      /* ignore */
    }
  }, []);

  const ensureSceneReady = useCallback(
    async (sceneId: string) => {
      const scene = scenesRef.current.find((item) => item.id === sceneId);
      const width = containerRef.current?.clientWidth || window.innerWidth;
      const quality = getAutomaticPanoramaQuality(width);
      prepareSceneRef.current?.(sceneId, width, quality);
      const result = await preloadPanoramaUrls(scenePreviewUrls(scene, width, quality));
      // A missing / unreachable HD profile must not leave a working economy scene blank.
      if (quality === "hd" && result.some(r => r.status === "rejected" || !r.value)) {
        prepareSceneRef.current?.(sceneId, width, "economy");
        await preloadPanoramaUrls(scenePreviewUrls(scene, width, "economy"));
      }
    },
    []
  );

  const handleSceneHotspotClick = useCallback(
    async (targetSceneId: string, pitch: number, yaw: number, entryView: SceneInitialView) => {
      const viewer = viewerRef.current;
      if (!viewer || divingRef.current) return;

      divingRef.current = true;
      externalNavRef.current = false;

      const transitionOpts = {
        entryView,
        ensureReady: async () => {
          await ensureSceneReady(targetSceneId);
        },
      };

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
          viewer.loadScene(targetSceneId, entryView.pitch, entryView.yaw, entryView.hfov);
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

  const destroyViewer = useCallback(() => {
    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
      } catch {
        /* ignore */
      }
      viewerRef.current = null;
    }
    prepareSceneRef.current = null;
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }, []);

  const initTourViewer = useCallback(async () => {
    const currentScenes = scenesRef.current;
    if (!containerRef.current || currentScenes.length === 0) return;

    const epoch = ++initEpochRef.current;
    destroyViewer();

    setPanoramaVisible(false);
    setViewerReady(false);
    setError(null);
    overlayController.reset();
    preloadInitialPanorama(currentScenes, activeSceneIdRef.current);

    try {
      await loadPannellum();
      // Stale init (Strict Mode / remount / retry) — jangan buat viewer kedua di kontainer yang sama.
      if (!isMounted.current || !containerRef.current || epoch !== initEpochRef.current) return;

      destroyViewer();
      if (!containerRef.current || epoch !== initEpochRef.current) return;

      const firstId = activeSceneIdRef.current ?? currentScenes[0]?.id;
      const handlers = {
        spaceMarker,
        onSceneHotspot: (id: string, pitch: number, yaw: number, entryView: SceneInitialView) => handleSceneHotspotRef.current(id, pitch, yaw, entryView),
        onScenePreload: (id: string, view: SceneInitialView) => {
          schedulePanoramaIntent(scenesRef.current.find((scene) => scene.id === id), view);
        },
        onSpaceClick: (code: string, target?: SpaceHotspotTarget) => onSpaceClickRef.current?.(code, target),
        onAdClick: (payload: import("@/lib/pannellum-tour-config").AdHotspotPayload) => onAdClickRef.current?.(payload),
        onInfoClick: (title: string, desc: string) => onInfoClickRef.current?.(title, desc),
        getSpaceStatus: (code: string) => findSpaceStatus(spacesRef.current, code),
      };
      const config = buildPannellumTourConfig(currentScenes, firstId, handlers);

      const viewer = window.pannellum.viewer(containerRef.current, {
        ...config,
        default: {
          ...config.default,
          strings: {
            loadButtonLabel: tRef.current("Klik untuk memuat panorama"),
            loadingLabel: tRef.current("Memuat panorama…"),
            noPanoramaError: tRef.current("Tidak dapat memuat panorama."),
            genericWebGLError: tRef.current("Tidak dapat memuat panorama."),
            unknownError: tRef.current("Tidak dapat memuat panorama."),
          },
        },
      });
      if (epoch !== initEpochRef.current) {
        try {
          viewer.destroy();
        } catch {
          /* ignore */
        }
        return;
      }

      viewerRef.current = viewer;
      const hdSceneIds = new Set<string>();
      prepareSceneRef.current = (sceneId, width, quality) => {
        if (viewerRef.current !== viewer || viewer.getScene?.() === sceneId) return;
        const target = scenesRef.current.find(scene => scene.id === sceneId);
        if (!target) return;
        const selected = selectQualityMultiRes(target, width, quality);
        if (selected && (selected === target.multiResProfilesHd?.desktop || selected === target.multiResProfilesHd?.mobile)) {
          hdSceneIds.add(sceneId);
        } else {
          hdSceneIds.delete(sceneId);
        }
        viewer.addScene(sceneId, buildPannellumSceneConfig(target, scenesRef.current, handlers, width, quality));
      };

      const revealLoadedScene = () => {
        if (!isMounted.current || epoch !== initEpochRef.current || viewerRef.current !== viewer) return;
        setViewerReady(true);
        setPanoramaVisible(true);
        setContainerEl(containerRef.current);
        setViewerForOverlay(viewer);
        requestAnimationFrame(() => {
          if (epoch === initEpochRef.current) {
            bindPrivacyBlursInContainer(viewer, containerRef.current);
          }
        });
        try {
          const sceneId = viewer.getScene?.();
          if (sceneId) {
            preloadLinkedScenes(scenesRef.current, sceneId);
            setInternalSceneId((prev) => (prev === sceneId ? prev : sceneId));
          }
        } catch {
          /* ignore */
        }
        if (focusCameraRef.current && focusTokenRef.current) {
          applyCameraFocus(viewer);
        }
      };

      viewer.on("load", revealLoadedScene);
      viewer.on("scenechange", (sceneId: string) => {
        if (!isMounted.current || epoch !== initEpochRef.current) return;
        if (typeof sceneId === "string" && sceneId) {
          // Hindari setState no-op → re-render → crossfade effect → load ulang
          setInternalSceneId((prev) => (prev === sceneId ? prev : sceneId));
        }
      });
      if (typeof viewer.isLoaded === "function" && viewer.isLoaded()) {
        revealLoadedScene();
      }

      viewer.on("error", (err: string) => {
        console.error("Pannellum error:", err);
        if (isMounted.current && epoch === initEpochRef.current) {
          const sceneId = viewer.getScene?.();
          const target = scenesRef.current.find(scene => scene.id === sceneId);
          if (target && hdSceneIds.delete(sceneId)) {
            recordPanoramaTileFailure();
            const width = containerRef.current?.clientWidth || window.innerWidth;
            const view = { pitch: viewer.getPitch(), yaw: viewer.getYaw(), hfov: viewer.getHfov() };
            try {
              viewer.addScene(sceneId, buildPannellumSceneConfig(target, scenesRef.current, handlers, width, "economy"));
              viewer.loadScene(sceneId, view.pitch, view.yaw, view.hfov);
              return;
            } catch { /* Fall through to the existing retry UI. */ }
          }
          setError("Gagal memuat panorama. Periksa koneksi internet.");
        }
      });
    } catch (e) {
      console.error("Viewer init error:", e);
      if (isMounted.current && epoch === initEpochRef.current) {
        setError(e instanceof Error ? e.message : "Gagal menginisialisasi viewer 360°");
      }
    }
  }, [applyCameraFocus, destroyViewer, overlayController, spaceMarker]);

  useEffect(() => {
    return observePanoramaNetwork();
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void initTourViewer();
    return () => {
      isMounted.current = false;
      initEpochRef.current += 1;
      destroyViewer();
      // Jangan setState di cleanup Strict Mode — biarkan init berikutnya yang set ulang
    };
  }, [initTourViewer, scenesSig, destroyViewer]);

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

        const focus = focusCameraRef.current;
        const entryView = focus && focus.hfov == null
          ? { yaw: focus.yaw, pitch: focus.pitch, hfov: viewer.getHfov() }
          : undefined;
        softCrossfadeScene(viewer, activeSceneId, overlayController, {
          entryView,
          ensureReady: async () => {
            await ensureSceneReady(activeSceneId);
          },
        })
          .catch(() => {
            try { viewer.loadScene(activeSceneId, entryView?.pitch, entryView?.yaw, entryView?.hfov); } catch { /* ignore */ }
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

  const autoRotateControl = panoramaVisible && !error ? (
    <button type="button" onClick={toggleAutoRotate} aria-label={t("Auto Putar")} aria-pressed={autoRotate}
      className={`flex shrink-0 items-center justify-center rounded-full backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${autoRotateControlContainer === undefined ? "size-10" : "size-11"} ${autoRotate ? `bg-[#E31E2D] text-white ${autoRotateControlContainer === undefined ? "shadow-[0_10px_24px_rgba(227,30,45,0.35)]" : ""}` : "tour-chrome-pill"}`}
      title={t("Auto Putar")}>{autoRotateControlContainer === undefined ? <Navigation className="size-4" /> : <RotateCw className="size-5" />}</button>
  ) : null;

  return (
    <div className="lrt-vt-viewer relative h-full w-full overflow-hidden bg-[#0a0f18]">
      <div
        className="lrt-vt-panorama-wrap absolute inset-0"
        style={{
          opacity: panoramaVisible ? 1 : 0,
          filter: overlay.blur > 0 ? `blur(${overlay.blur}px)` : undefined,
          transform: overlay.vignette > 0 ? `scale(${1 + overlay.vignette * 0.06})` : undefined,
        }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        {viewerReady && spatialEnabled && activeSpatialEntities.length > 0 && (
          <SpatialOverlay
            viewer={viewerForOverlay}
            container={containerEl}
            entities={activeSpatialEntities}
            interactive
            resolveSpaceStatus={(code) => findSpaceStatus(spacesRef.current, code)}
            onEntityClick={(entity) => {
              runSpatialAction(entity, {
                openUnit: (code) => onSpaceClickRef.current?.(code, { sceneId: entity.sceneId, spatialId: entity.id }),
                openScene: (id) => {
                  if (scenesRef.current.some((scene) => scene.id === id)) {
                    const pitch = viewerRef.current?.getPitch() ?? 0;
                    const yaw = viewerRef.current?.getYaw() ?? 0;
                    const entryView = resolveSceneEntryView({ pitch, yaw }, scenesRef.current.find((scene) => scene.id === id)?.initialView);
                    void handleSceneHotspotRef.current(id, pitch, yaw, entryView);
                  }
                },
                openInfo: (title, description) => onInfoClickRef.current?.(title, description),
              });
            }}
          />
        )}
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
            <p className="text-white font-semibold mb-2">{t(error)}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => initTourViewer()}
              className="text-white border-white/30 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("Coba Lagi")}
            </Button>
          </div>
        </div>
      )}

      {!error && scenes.length > 1 && !hideSceneBar && (
        <div className="absolute bottom-4 left-1/2 z-10 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center justify-center gap-2">
          <div
            className={`flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border px-3 py-2 shadow-2xl backdrop-blur-md ${
              chromeTone === "maroon"
                ? "border-[color:rgb(255_214_218_/_0.14)] bg-[#1C0A0E]/78"
                : "border-white/15 bg-black/65"
            }`}
          >
            {scenes.map((scene, idx) => (
              <button
                key={scene.id}
                onClick={() => switchScene(idx)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  currentSceneIdx === idx
                    ? "bg-[#E31E2D] text-white shadow-md"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {content(scene.title)}
              </button>
            ))}
          </div>
        </div>
      )}

      {autoRotateControlContainer === undefined
        ? <div className="absolute bottom-24 right-4 z-[45] sm:bottom-28">{autoRotateControl}</div>
        : autoRotateControlContainer && createPortal(autoRotateControl, autoRotateControlContainer)}

      <style>{`
        .pnlm-container { background: ${chromeTone === "maroon" ? "#1c0a0e" : "#0a0f18"} !important; }
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
