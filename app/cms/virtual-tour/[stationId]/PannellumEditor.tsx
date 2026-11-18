"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { ImageIcon } from "lucide-react";
import type { ViewerBakeContext } from "@/lib/panorama-privacy-blur-geometry";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { AddMode, HotspotItem } from "@/lib/hotspot-types";
import type { PrivacyBlurItem } from "@/lib/privacy-blur-types";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { findSpaceStatus } from "@/lib/space-availability";
import {
  setupHotspotElement,
  resolveSceneHotspotTitle,
  setHotspotSelected,
  setHotspotScale,
  setSceneNavDirection,
  type SpaceHotspotMarker,
} from "@/lib/pannellum-hotspot";
import {
  bindPrivacyBlursInContainer,
  setupPrivacyBlurElement,
  setPrivacyBlurSelected,
  setPrivacyBlurDimensions,
} from "@/lib/pannellum-privacy-blur";
import { PANNELLUM_EDITOR_HFOV, PANNELLUM_INTERACTION, PANNELLUM_PITCH_LIMITS } from "@/lib/pannellum-viewer-defaults";
import type { SceneInitialView } from "@/lib/tour-types";
import { PANNELLUM_HFOV } from "@/lib/pannellum-viewer-defaults";
import { SpatialOverlay } from "@/components/tour/spatial/SpatialOverlay";
import type { SpatialEntity, SphericalPoint } from "@/lib/spatial/types";
import type { PannellumMultiRes } from "@/lib/panorama-profile";
import {
  EditorPanoramaPreviewToggle,
  type EditorPanoramaPreviewMode,
} from "@/components/cms/EditorPanoramaPreviewToggle";

export type { EditorPanoramaPreviewMode };

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pannellum: any;
  }
}

const DRAG_THRESHOLD_PX = 6;

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
      script.onerror = () => reject(new Error("Gagal memuat Pannellum"));
      document.body.appendChild(script);
    } else {
      let t = 0;
      const iv = setInterval(() => {
        if (window.pannellum) { clearInterval(iv); resolve(); }
        else if (++t > 40) { clearInterval(iv); reject(new Error("Pannellum timeout")); }
      }, 100);
    }
  });
}

function roundCoord(n: number) {
  return Math.round(n * 10) / 10;
}

function buildEditorHotspotEl(
  div: HTMLDivElement,
  h: HotspotItem,
  isSelected: boolean,
  getSpaceStatus: (code: string) => SpaceAvailabilityStatus | undefined,
  getSceneTitle: (sceneId: string | undefined, fallback: string) => string,
  onPointerDownRef: React.MutableRefObject<(kind: "hotspot" | "blur", id: string, e: PointerEvent) => void>,
  onDeleteRef: React.MutableRefObject<(kind: "hotspot" | "blur", id: string) => void>,
  spaceMarker: SpaceHotspotMarker
) {
  const spaceStatus =
    h.type === "space" && h.spaceCode ? getSpaceStatus(h.spaceCode) : undefined;
  setupHotspotElement(div, {
    type: h.type,
    spaceMarker,
    selected: isSelected,
    scale: h.scale,
    spaceStatus,
    spaceCode: h.type === "space" ? h.spaceCode : undefined,
    facilityIcon: h.type === "info" ? h.facilityIcon : undefined,
    sceneTitle:
      h.type === "scene" ? getSceneTitle(h.sceneId, h.text) : undefined,
    direction: h.type === "scene" ? h.direction : undefined,
  });
  div.style.cursor = "grab";

  div.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onPointerDownRef.current("hotspot", h._id, e);
  });

  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteRef.current("hotspot", h._id);
  });
}

function buildEditorBlurEl(
  div: HTMLDivElement,
  blur: PrivacyBlurItem,
  isSelected: boolean,
  guideOnly: boolean,
  onPointerDownRef: React.MutableRefObject<(kind: "hotspot" | "blur", id: string, e: PointerEvent) => void>,
  onDeleteRef: React.MutableRefObject<(kind: "hotspot" | "blur", id: string) => void>
) {
  setupPrivacyBlurElement(div, {
    editor: true,
    guideOnly,
    selected: isSelected,
    width: blur.width,
    height: blur.height,
    intensity: blur.intensity,
    radius: blur.radius,
    scale: blur.scale,
  });
  div.style.cursor = "grab";

  div.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onPointerDownRef.current("blur", blur._id, e);
  });

  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteRef.current("blur", blur._id);
  });
}

interface Props {
  spaceMarker?: SpaceHotspotMarker;
  /** Panorama display (~6000px) — mode Display / fallback Hemat. */
  panoramaUrl: string;
  /** Master native asli — fallback mode HD bila tile HD belum siap. */
  originalPanoramaUrl?: string | null;
  /** Tile Hemat opsional — kalau ada, mode Hemat pakai tile publik (hasil bake). */
  hematMultiRes?: PannellumMultiRes | null;
  /** Tile HD publik (hasil bake) — prioritas mode HD di editor. */
  hdMultiRes?: PannellumMultiRes | null;
  previewMode?: EditorPanoramaPreviewMode;
  onPreviewModeChange?: (mode: EditorPanoramaPreviewMode) => void;
  hotspots: HotspotItem[];
  privacyBlurs: PrivacyBlurItem[];
  selectedId: string | null;
  selectedBlurId: string | null;
  addMode: AddMode;
  onHotspotAdd: (yaw: number, pitch: number) => void;
  onBlurAdd: (yaw: number, pitch: number) => void;
  onHotspotMove: (id: string, yaw: number, pitch: number) => void;
  onBlurMove: (id: string, yaw: number, pitch: number) => void;
  onHotspotSelect: (id: string | null) => void;
  onBlurSelect: (id: string | null) => void;
  onHotspotDelete: (id: string) => void;
  onBlurDelete: (id: string) => void;
  spaces?: { code: string; status: SpaceAvailabilityStatus }[];
  scenes?: { sceneId: string; title: string }[];
  initialView?: SceneInitialView | null;
  minHfov?: number;
  /** Setelah pernah dibake: overlay tanpa backdrop (hindari double blur). */
  privacyBlurGuideOnly?: boolean;
  spatialEntities?: SpatialEntity[];
  draftSpatialVertices?: SphericalPoint[];
  selectedSpatialId?: string | null;
  onSpatialSelect?: (id: string | null) => void;
  onSpatialVertexAdd?: (yaw: number, pitch: number) => void;
  onSpatialGeometryCommit?: (id: string, vertices: SphericalPoint[]) => void;
  onSpatialEditError?: (message: string) => void;
  onSpatialCloseDraft?: () => void;
}

function proxyMultiRes(multiRes: PannellumMultiRes) {
  return {
    ...multiRes,
    basePath: getS3ProxyUrl(multiRes.basePath).replace(/\/$/, ""),
  };
}

export type PannellumEditorHandle = {
  getView: () => { yaw: number; pitch: number; hfov: number } | null;
  getViewerBakeContext: () => ViewerBakeContext | null;
};

export const PannellumEditor = forwardRef<PannellumEditorHandle, Props>(function PannellumEditor(
  {
    panoramaUrl,
    originalPanoramaUrl = null,
    hematMultiRes = null,
    hdMultiRes = null,
    previewMode = "display",
    onPreviewModeChange,
    hotspots,
    privacyBlurs,
    selectedId,
    selectedBlurId,
    addMode,
    onHotspotAdd,
    onBlurAdd,
    onHotspotMove,
    onBlurMove,
    onHotspotSelect,
    onBlurSelect,
    onHotspotDelete,
    onBlurDelete,
    spaces = [],
    scenes = [],
    initialView = null,
    minHfov = PANNELLUM_EDITOR_HFOV.minHfov,
    privacyBlurGuideOnly = false,
    spaceMarker = "info-pin",
    spatialEntities = [],
    draftSpatialVertices = [],
    selectedSpatialId = null,
    onSpatialSelect,
    onSpatialVertexAdd,
    onSpatialGeometryCommit,
    onSpatialEditError,
    onSpatialCloseDraft,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const viewerReadyRef = useRef(false);
  const [viewerTick, setViewerTick] = useState(0);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewerForOverlay, setViewerForOverlay] = useState<any>(null);
  const [liveView, setLiveView] = useState<{ yaw: number; pitch: number; hfov: number } | null>(
    null
  );
  const onSpatialVertexAddRef = useRef(onSpatialVertexAdd);
  const onSpatialSelectRef = useRef(onSpatialSelect);
  const mountedHotspotIdsRef = useRef<string[]>([]);
  const mountedBlurIdsRef = useRef<string[]>([]);
  const hotspotDomRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const blurDomRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const hotspotTypeRef = useRef<Map<string, HotspotItem["type"]>>(new Map());
  const hotspotsRef = useRef(hotspots);
  const privacyBlursRef = useRef(privacyBlurs);
  const spacesRef = useRef(spaces);
  const scenesRef = useRef(scenes);
  const getSpaceStatusRef = useRef((code: string) => findSpaceStatus(spacesRef.current, code));

  const onSelectRef = useRef(onHotspotSelect);
  const onBlurSelectRef = useRef(onBlurSelect);
  const onDeleteRef = useRef(onHotspotDelete);
  const onBlurDeleteRef = useRef(onBlurDelete);
  const onAddRef = useRef(onHotspotAdd);
  const onBlurAddRef = useRef(onBlurAdd);
  const onMoveRef = useRef(onHotspotMove);
  const onBlurMoveRef = useRef(onBlurMove);
  const addModeRef = useRef(addMode);

  // Display/Hemat = hasil bake (display / tile Hemat). HD = tile HD bake bila ada, else original.
  const hasHdPreview = Boolean(hdMultiRes) || Boolean(originalPanoramaUrl);
  const resolvedPreviewMode: EditorPanoramaPreviewMode =
    previewMode === "hd" && hasHdPreview
      ? "hd"
      : previewMode === "hemat"
        ? "hemat"
        : "display";
  const hdUsesBakedTiles =
    resolvedPreviewMode === "hd" && Boolean(hdMultiRes);
  const activeEquirectUrl =
    resolvedPreviewMode === "hd" && !hdMultiRes && originalPanoramaUrl
      ? originalPanoramaUrl
      : panoramaUrl;
  const activeMultiRes =
    resolvedPreviewMode === "hemat" && hematMultiRes
      ? hematMultiRes
      : hdUsesBakedTiles && hdMultiRes
        ? hdMultiRes
        : null;
  const sourceKey = activeMultiRes
    ? `mr:${activeMultiRes.basePath}|${activeMultiRes.cubeResolution}|${activeMultiRes.tileResolution}`
    : `eq:${activeEquirectUrl}`;
  // Guide-only saat piksel sudah bake. Original native belum bake → overlay CSS blur.
  const effectiveGuideOnly =
    privacyBlurGuideOnly &&
    !(resolvedPreviewMode === "hd" && !hdUsesBakedTiles);
  const privacyBlurGuideOnlyRef = useRef(effectiveGuideOnly);

  useImperativeHandle(ref, () => ({
    getViewerBakeContext: () => {
      if (!containerRef.current || !viewerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;
      const hfov =
        typeof viewerRef.current.getHfov === "function" ? viewerRef.current.getHfov() : 100;
      return {
        viewerWidth: rect.width,
        viewerHeight: rect.height,
        hfov: Number.isFinite(hfov) ? hfov : 100,
      };
    },
    getView: () => {
      const viewer = viewerRef.current;
      if (!viewer || !viewerReadyRef.current) return null;
      try {
        return {
          yaw: Number(viewer.getYaw()),
          pitch: Number(viewer.getPitch()),
          hfov: Number(viewer.getHfov()),
        };
      } catch {
        return null;
      }
    },
  }));

  useEffect(() => {
    privacyBlurGuideOnlyRef.current = effectiveGuideOnly;
  }, [effectiveGuideOnly]);

  useEffect(() => {
    hotspotsRef.current = hotspots;
    privacyBlursRef.current = privacyBlurs;
    spacesRef.current = spaces;
    scenesRef.current = scenes;
    getSpaceStatusRef.current = (code: string) => findSpaceStatus(spacesRef.current, code);
  }, [hotspots, privacyBlurs, spaces, scenes]);

  useEffect(() => {
    onSelectRef.current = onHotspotSelect;
    onBlurSelectRef.current = onBlurSelect;
    onDeleteRef.current = onHotspotDelete;
    onBlurDeleteRef.current = onBlurDelete;
    onAddRef.current = onHotspotAdd;
    onBlurAddRef.current = onBlurAdd;
    onMoveRef.current = onHotspotMove;
    onBlurMoveRef.current = onBlurMove;
    addModeRef.current = addMode;
    onSpatialVertexAddRef.current = onSpatialVertexAdd;
    onSpatialSelectRef.current = onSpatialSelect;
  }, [
    addMode,
    onBlurAdd,
    onBlurDelete,
    onBlurMove,
    onBlurSelect,
    onHotspotAdd,
    onHotspotDelete,
    onHotspotMove,
    onHotspotSelect,
    onSpatialSelect,
    onSpatialVertexAdd,
  ]);

  useEffect(() => {
    const el = containerRef.current;
    setContainerEl((prev) => (prev === el ? prev : el));
  }, [panoramaUrl, viewerTick]);

  const [dragging, setDragging] = useState(false);
  const pointerRef = useRef<{
    kind: "add" | "hotspot" | "blur";
    pointerId: number;
    id?: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const dragIdRef = useRef<{ kind: "hotspot" | "blur"; id: string } | null>(null);
  const selectedIdRef = useRef(selectedId);
  const selectedBlurIdRef = useRef(selectedBlurId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    selectedBlurIdRef.current = selectedBlurId;
  }, [selectedBlurId, selectedId]);

  const onPointerDownItem = useCallback((kind: "hotspot" | "blur", id: string, e: PointerEvent) => {
    if (addModeRef.current !== "none") return;
    pointerRef.current = { kind, id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    dragIdRef.current = null;
    setDragging(false);
  }, []);

  const onPointerDownItemRef = useRef(onPointerDownItem);
  const onDeleteItemRef = useRef((kind: "hotspot" | "blur", id: string) => {
    if (kind === "hotspot") onDeleteRef.current(id);
    else onBlurDeleteRef.current(id);
  });

  useEffect(() => {
    onPointerDownItemRef.current = onPointerDownItem;
  }, [onPointerDownItem]);

  const syncPrivacyBlurs = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewer: any, blurs: PrivacyBlurItem[]) => {
      if (!viewer) return;
      for (const id of mountedBlurIdsRef.current) {
        try { viewer.removeHotSpot(id); } catch { /* ignore */ }
      }
      mountedBlurIdsRef.current = [];
      blurDomRef.current.clear();

      for (const blur of blurs) {
        try {
          viewer.addHotSpot({
            id: blur._id,
            pitch: blur.pitch,
            yaw: blur.yaw,
            type: "custom",
            cssClass: "lrt-privacy-blur-hs lrt-editor-blur",
            createTooltipFunc: (div: HTMLDivElement) => {
              blurDomRef.current.set(blur._id, div);
              buildEditorBlurEl(
                div,
                blur,
                blur._id === selectedBlurIdRef.current,
                privacyBlurGuideOnlyRef.current,
                onPointerDownItemRef,
                onDeleteItemRef
              );
            },
          });
          mountedBlurIdsRef.current.push(blur._id);
        } catch { /* ignore */ }
      }

      requestAnimationFrame(() => {
        bindPrivacyBlursInContainer(viewer, containerRef.current);
      });
    },
    []
  );

  const syncHotspots = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewer: any, hs: HotspotItem[]) => {
      if (!viewer) return;
      for (const id of mountedHotspotIdsRef.current) {
        try { viewer.removeHotSpot(id); } catch { /* ignore */ }
      }
      mountedHotspotIdsRef.current = [];
      hotspotDomRef.current.clear();
      hotspotTypeRef.current.clear();

      for (const h of hs) {
        try {
          viewer.addHotSpot({
            id: h._id,
            pitch: h.pitch,
            yaw: h.yaw,
            type: "custom",
            cssClass: `lrt-editor-hs lrt-${h.type}-hotspot`,
            createTooltipFunc: (div: HTMLDivElement) => {
              hotspotDomRef.current.set(h._id, div);
              hotspotTypeRef.current.set(h._id, h.type);
              buildEditorHotspotEl(
                div,
                h,
                h._id === selectedIdRef.current,
                (code) => getSpaceStatusRef.current(code),
                (sceneId, fallback) =>
                  resolveSceneHotspotTitle(sceneId, scenesRef.current, fallback),
                onPointerDownItemRef,
                onDeleteItemRef,
                spaceMarker
              );
            },
          });
          mountedHotspotIdsRef.current.push(h._id);
        } catch { /* ignore */ }
      }
    },
    [spaceMarker]
  );

  const syncAllOverlays = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewer: any) => {
      syncPrivacyBlurs(viewer, privacyBlursRef.current);
      syncHotspots(viewer, hotspotsRef.current);
    },
    [syncHotspots, syncPrivacyBlurs]
  );

  // Init viewer — re-init saat sumber panorama / mode preview berubah
  useEffect(() => {
    if (!containerRef.current || !panoramaUrl) return;
    const isMounted = { current: true };
    const hotspotDom = hotspotDomRef.current;
    const blurDom = blurDomRef.current;

    async function init() {
      try {
        await loadPannellum();
        if (!isMounted.current || !containerRef.current) return;

        if (viewerRef.current) {
          try { viewerRef.current.destroy(); } catch { /* ignore */ }
          viewerRef.current = null;
        }
        viewerReadyRef.current = false;

        const sourceConfig = activeMultiRes
          ? { type: "multires" as const, multiRes: proxyMultiRes(activeMultiRes) }
          : { type: "equirectangular" as const, panorama: getS3ProxyUrl(activeEquirectUrl) };

        viewerRef.current = window.pannellum.viewer(containerRef.current, {
          ...sourceConfig,
          autoLoad: true,
          autoRotate: 0,
          draggable: true,
          showControls: true,
          showFullscreenCtrl: false,
          showZoomCtrl: true,
          ...PANNELLUM_EDITOR_HFOV,
          minHfov,
          ...(initialView
            ? {
                yaw: initialView.yaw,
                pitch: initialView.pitch,
                hfov: initialView.hfov ?? PANNELLUM_HFOV.hfov,
              }
            : {}),
          ...PANNELLUM_PITCH_LIMITS,
          ...PANNELLUM_INTERACTION,
          hotSpots: [],
        });

        viewerRef.current.on("load", () => {
          viewerReadyRef.current = true;
          syncAllOverlays(viewerRef.current);
          setViewerForOverlay(viewerRef.current);
          setViewerTick((n) => n + 1);
        });
      } catch (err) {
        console.error("PannellumEditor init error:", err);
      }
    }

    init();

    return () => {
      isMounted.current = false;
      viewerReadyRef.current = false;
      mountedHotspotIdsRef.current = [];
      mountedBlurIdsRef.current = [];
      hotspotDom.clear();
      blurDom.clear();
      setViewerForOverlay(null);
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panoramaUrl, originalPanoramaUrl, resolvedPreviewMode, sourceKey]);

  const hotspotsSig = JSON.stringify(
    hotspots.map((h) => [
      h._id,
      h.pitch,
      h.yaw,
      h.type,
      h.text,
      h.scale ?? 1,
      h.spaceCode ?? "",
      h.sceneId ?? "",
      h.facilityIcon ?? "",
    ])
  );
  const spacesSig = spaces.map((s) => `${s.code}:${s.status}`).join("|");
  const blursSig = JSON.stringify(
    privacyBlurs.map((b) => [b._id, b.pitch, b.yaw, b.width, b.height, b.intensity, b.radius, b.scale ?? 1])
  );

  useEffect(() => {
    if (!viewerReadyRef.current || !viewerRef.current) return;
    // Pakai state terkini (bukan hanya ref) agar yaw/pitch/scale unit langsung ikut.
    hotspotsRef.current = hotspots;
    privacyBlursRef.current = privacyBlurs;
    syncHotspots(viewerRef.current, hotspots);
    syncPrivacyBlurs(viewerRef.current, privacyBlurs);
  }, [hotspotsSig, blursSig, spacesSig, hotspots, privacyBlurs, syncHotspots, syncPrivacyBlurs]);

  const scaleSig = hotspots.map((h) => `${h._id}:${h.scale ?? 1}`).join("|");
  useEffect(() => {
    if (!viewerReadyRef.current) return;
    for (const h of hotspots) {
      const div = hotspotDomRef.current.get(h._id);
      if (div) setHotspotScale(div, h.scale);
    }
  }, [scaleSig, hotspots]);

  const dirSig = hotspots.map((h) => `${h._id}:${h.direction ?? "right"}`).join("|");
  useEffect(() => {
    if (!viewerReadyRef.current) return;
    for (const h of hotspots) {
      if (h.type !== "scene") continue;
      const div = hotspotDomRef.current.get(h._id);
      if (div) setSceneNavDirection(div, h.direction);
    }
  }, [dirSig, hotspots]);

  const blurDimSig = privacyBlurs
    .map((b) => `${b._id}:${b.width}:${b.height}:${b.intensity}:${b.radius}:${b.scale ?? 1}`)
    .join("|");
  const guideSig = effectiveGuideOnly ? "1" : "0";
  useEffect(() => {
    if (!viewerReadyRef.current) return;
    for (const b of privacyBlurs) {
      const div = blurDomRef.current.get(b._id);
      if (div) setPrivacyBlurDimensions(div, b, true, effectiveGuideOnly);
    }
  }, [blurDimSig, privacyBlurs, guideSig, effectiveGuideOnly]);

  useEffect(() => {
    hotspotDomRef.current.forEach((div, id) => {
      const type = hotspotTypeRef.current.get(id) ?? "scene";
      setHotspotSelected(div, type, id === selectedId);
    });
    blurDomRef.current.forEach((div, id) => {
      setPrivacyBlurSelected(div, id === selectedBlurId, true);
    });
  }, [selectedId, selectedBlurId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isPinAuthoring = (mode: AddMode) =>
      mode === "scene" || mode === "space" || mode === "info" || mode === "ad" || mode === "blur";

    const isPanoramaInput = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element) || !container.contains(target)) return false;
      if (target.closest("button, a, input, select, textarea, [role=button], [contenteditable=true], .pnlm-controls, .pnlm-about-msg, .lrt-editor-hs, .lrt-editor-blur, .spatial-hit, .spatial-badge")) return false;
      const rect = container.getBoundingClientRect();
      return e.clientX >= rect.left && e.clientX < rect.right && e.clientY >= rect.top && e.clientY < rect.bottom;
    };

    const onPointerDown = (e: PointerEvent) => {
      const mode = addModeRef.current;
      // pan / select: jangan pasang pin; spatial pakai jalur add terpisah
      if (!isPinAuthoring(mode) && mode !== "spatial") return;
      if (e.button !== 0 || !e.isPrimary || !isPanoramaInput(e)) return;
      pointerRef.current = { kind: "add", pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = pointerRef.current;
      if (!p || p.pointerId !== e.pointerId) return;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (dist <= DRAG_THRESHOLD_PX) return;
      p.moved = true;

      if ((p.kind === "hotspot" || p.kind === "blur") && p.id && !dragIdRef.current) {
        dragIdRef.current = { kind: p.kind, id: p.id };
        setDragging(true);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const p = pointerRef.current;
      if (!p || p.pointerId !== e.pointerId) return;
      pointerRef.current = null;

      if (!viewerRef.current || !viewerReadyRef.current) {
        dragIdRef.current = null;
        setDragging(false);
        return;
      }

      if (p.kind === "add" && !p.moved && isPanoramaInput(e)) {
        try {
          const coords: [number, number] = viewerRef.current.mouseEventToCoords(e);
          const yaw = roundCoord(coords[1]);
          const pitch = roundCoord(coords[0]);
          if (addModeRef.current === "spatial") {
            onSpatialVertexAddRef.current?.(yaw, pitch);
          } else if (isPinAuthoring(addModeRef.current)) {
            if (addModeRef.current === "blur") onBlurAddRef.current(yaw, pitch);
            else onAddRef.current(yaw, pitch);
          }
        } catch { /* ignore */ }
      } else if ((p.kind === "hotspot" || p.kind === "blur") && p.id) {
        if (dragIdRef.current?.id === p.id && dragIdRef.current.kind === p.kind) {
          try {
            const coords: [number, number] = viewerRef.current.mouseEventToCoords(e);
            const yaw = roundCoord(coords[1]);
            const pitch = roundCoord(coords[0]);
            if (p.kind === "blur") onBlurMoveRef.current(p.id, yaw, pitch);
            else onMoveRef.current(p.id, yaw, pitch);
          } catch { /* ignore */ }
        } else if (!p.moved) {
          if (p.kind === "blur") {
            onBlurSelectRef.current(p.id);
            onSelectRef.current(null);
          } else {
            onSelectRef.current(p.id);
            onBlurSelectRef.current(null);
          }
        }
      }

      dragIdRef.current = null;
      setDragging(false);
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (pointerRef.current?.pointerId !== e.pointerId) return;
      pointerRef.current = null;
      dragIdRef.current = null;
      setDragging(false);
    };

    // Authoring begins on the panorama, never on toolbar / inspector controls.
    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, []);

  const addModeLabel =
    addMode === "scene"
      ? "scene"
      : addMode === "space"
        ? "unit komersial"
        : addMode === "ad"
          ? "media iklan"
          : addMode === "info"
            ? "info"
            : addMode === "blur"
              ? "blur privasi"
              : addMode === "spatial"
                ? "spatial area"
                : addMode === "pan"
                  ? "pan"
                  : "";

  const showAuthoringHint =
    addMode === "scene" ||
    addMode === "space" ||
    addMode === "info" ||
    addMode === "ad" ||
    addMode === "blur" ||
    addMode === "spatial";

  useEffect(() => {
    let raf = 0;
    let alive = true;
    let lastHudUpdate = -Infinity;
    const tick = (now: number) => {
      if (!alive) return;
      // Camera/rendering stays at native refresh rate; numeric HUD needs 10 Hz.
      if (now - lastHudUpdate < 100) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastHudUpdate = now;
      const v = viewerRef.current;
      if (v && typeof v.getYaw === "function") {
        try {
          const next = {
            yaw: Number(v.getYaw()),
            pitch: Number(v.getPitch()),
            hfov: Number(v.getHfov?.() ?? 100),
          };
          setLiveView((prev) => {
            if (
              prev &&
              Math.abs(prev.yaw - next.yaw) < 0.05 &&
              Math.abs(prev.pitch - next.pitch) < 0.05 &&
              Math.abs(prev.hfov - next.hfov) < 0.2
            ) {
              return prev;
            }
            return next;
          });
        } catch {
          /* ignore */
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [viewerTick, panoramaUrl]);

  return (
    <div className="cms-vt-panorama relative h-full min-h-0 w-full overflow-hidden overscroll-none select-none">
      <div ref={containerRef} className="absolute inset-0" style={{ background: "#1C0A0E" }} />

      {viewerTick > 0 && viewerForOverlay && (
        <SpatialOverlay
          viewer={viewerForOverlay}
          container={containerEl}
          entities={spatialEntities}
          draftVertices={draftSpatialVertices}
          selectedId={selectedSpatialId}
          interactive={addMode === "none"}
          onGeometryCommit={addMode === "none" ? onSpatialGeometryCommit : undefined}
          onEditError={onSpatialEditError}
          onCloseDraft={onSpatialCloseDraft}
          resolveSpaceStatus={(code) => getSpaceStatusRef.current(code)}
          onSelect={(id) => {
            onSpatialSelectRef.current?.(id);
            if (id) {
              onSelectRef.current(null);
              onBlurSelectRef.current(null);
            }
          }}
        />
      )}

      {dragging && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--work-subtle)]/90 backdrop-blur border border-amber-500/60 text-amber-300 text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <span className="text-base">✥</span>
            Lepas untuk menetapkan posisi baru
          </div>
        </div>
      )}

      {showAuthoringHint && (
        <div
          className={`absolute left-1/2 top-3 z-20 -translate-x-1/2 pointer-events-none rounded-full border px-3 py-1.5 text-xs shadow-md backdrop-blur ${
            addMode === "blur"
              ? "border-[var(--work-line)] bg-[var(--work-subtle)]/90 text-[var(--work-muted)]"
              : addMode === "spatial"
                ? "border-emerald-500/50 bg-[var(--work-subtle)]/90 text-[var(--work-success)]"
                : "border-emerald-500/40 bg-[var(--work-subtle)]/90 text-[var(--work-success)]"
          }`}
        >
          {addMode === "spatial"
              ? `Klik sudut area · ${draftSpatialVertices.length} titik`
              : addMode === "space"
                ? "Klik posisi unit"
              : (
                <>
                  Klik untuk pasang <strong>{addModeLabel}</strong>
                </>
              )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 px-3 pb-3">
        <div className="flex flex-col gap-1.5">
          <div className="rounded-md border border-[var(--work-line)] bg-[var(--work-subtle)]/85 px-2.5 py-1.5 font-mono text-[10px] tabular-nums text-[var(--work-muted)] backdrop-blur">
            {liveView
              ? `Yaw ${liveView.yaw.toFixed(1)}° · Pitch ${liveView.pitch.toFixed(1)}° · HFOV ${liveView.hfov.toFixed(0)}°`
              : "Yaw — · Pitch — · HFOV —"}
          </div>
          {onPreviewModeChange && (
            <div className="pointer-events-auto">
              <EditorPanoramaPreviewToggle
                size="canvas"
                value={resolvedPreviewMode}
                onChange={onPreviewModeChange}
                hasHematTiles={Boolean(hematMultiRes)}
                hasHdTiles={Boolean(hdMultiRes)}
                hasHdOriginal={Boolean(originalPanoramaUrl)}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="inline-flex h-7 items-center rounded-md border border-[var(--work-line)] bg-[var(--work-subtle)]/85 px-2 text-[10px] text-[var(--work-muted)] backdrop-blur">
            <span className="inline-block w-[7.5rem] shrink-0 truncate tabular-nums">
              {resolvedPreviewMode === "display"
                ? "Display (edit)"
                : resolvedPreviewMode === "hemat"
                  ? hematMultiRes
                    ? "Hemat (tile bake)"
                    : "Hemat (display)"
                  : hdUsesBakedTiles
                    ? "HD (tile bake)"
                    : "HD (original)"}
            </span>
            <span className="shrink-0 text-[var(--work-muted)]"> · </span>
            <span className="shrink-0 tabular-nums">
              {hotspots.length} hotspot
              {spatialEntities.length > 0 ? ` · ${spatialEntities.length} spatial` : ""}
              {privacyBlurs.length > 0 ? ` · ${privacyBlurs.length} blur` : ""}
            </span>
          </span>
        </div>
      </div>

      {!panoramaUrl && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[var(--work-subtle)] text-[var(--work-muted)]">
          <ImageIcon className="size-10 opacity-40" aria-hidden />
          <p className="text-sm">Upload panorama equirectangular untuk mulai edit</p>
        </div>
      )}
    </div>
  );
});
