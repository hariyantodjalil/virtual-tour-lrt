"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { AddMode, HotspotItem } from "@/lib/hotspot-types";
import type { PrivacyBlurItem } from "@/lib/privacy-blur-types";
import type { SpaceAvailabilityStatus } from "@/lib/space-availability";
import { findSpaceStatus } from "@/lib/space-availability";
import {
  setupHotspotElement,
  setHotspotSelected,
  setHotspotScale,
} from "@/lib/pannellum-hotspot";
import {
  setupPrivacyBlurElement,
  setPrivacyBlurSelected,
  setPrivacyBlurDimensions,
} from "@/lib/pannellum-privacy-blur";
import { PANNELLUM_INTERACTION } from "@/lib/pannellum-viewer-defaults";

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
  onPointerDownRef: React.MutableRefObject<(kind: "hotspot" | "blur", id: string, e: PointerEvent) => void>,
  onDeleteRef: React.MutableRefObject<(kind: "hotspot" | "blur", id: string) => void>
) {
  const spaceStatus =
    h.type === "space" && h.spaceCode ? getSpaceStatus(h.spaceCode) : undefined;
  setupHotspotElement(div, { type: h.type, selected: isSelected, scale: h.scale, spaceStatus });
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
  onPointerDownRef: React.MutableRefObject<(kind: "hotspot" | "blur", id: string, e: PointerEvent) => void>,
  onDeleteRef: React.MutableRefObject<(kind: "hotspot" | "blur", id: string) => void>
) {
  setupPrivacyBlurElement(div, {
    editor: true,
    selected: isSelected,
    width: blur.width,
    height: blur.height,
    intensity: blur.intensity,
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
  panoramaUrl: string;
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
}

export function PannellumEditor({
  panoramaUrl,
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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const viewerReadyRef = useRef(false);
  const mountedHotspotIdsRef = useRef<string[]>([]);
  const mountedBlurIdsRef = useRef<string[]>([]);
  const hotspotDomRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const blurDomRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const hotspotTypeRef = useRef<Map<string, HotspotItem["type"]>>(new Map());
  const hotspotsRef = useRef(hotspots);
  const privacyBlursRef = useRef(privacyBlurs);
  const spacesRef = useRef(spaces);
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

  useEffect(() => {
    hotspotsRef.current = hotspots;
    privacyBlursRef.current = privacyBlurs;
    spacesRef.current = spaces;
    getSpaceStatusRef.current = (code: string) => findSpaceStatus(spacesRef.current, code);
  }, [hotspots, privacyBlurs, spaces]);

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
  ]);

  const [dragging, setDragging] = useState(false);
  const pointerRef = useRef<{
    kind: "add" | "hotspot" | "blur";
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
    pointerRef.current = { kind, id, x: e.clientX, y: e.clientY, moved: false };
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
                onPointerDownItemRef,
                onDeleteItemRef
              );
            },
          });
          mountedBlurIdsRef.current.push(blur._id);
        } catch { /* ignore */ }
      }
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
                onPointerDownItemRef,
                onDeleteItemRef
              );
            },
          });
          mountedHotspotIdsRef.current.push(h._id);
        } catch { /* ignore */ }
      }
    },
    []
  );

  const syncAllOverlays = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewer: any) => {
      syncPrivacyBlurs(viewer, privacyBlursRef.current);
      syncHotspots(viewer, hotspotsRef.current);
    },
    [syncHotspots, syncPrivacyBlurs]
  );

  // Init viewer
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
        viewerReadyRef.current = false;

        viewerRef.current = window.pannellum.viewer(containerRef.current, {
          type: "equirectangular",
          panorama: getS3ProxyUrl(panoramaUrl),
          autoLoad: true,
          autoRotate: 0,
          draggable: true,
          showControls: true,
          showFullscreenCtrl: false,
          showZoomCtrl: true,
          hfov: 100,
          minHfov: 40,
          maxHfov: 120,
          ...PANNELLUM_INTERACTION,
          hotSpots: [],
        });

        viewerRef.current.on("load", () => {
          viewerReadyRef.current = true;
          syncAllOverlays(viewerRef.current);
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
      hotspotDomRef.current.clear();
      blurDomRef.current.clear();
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panoramaUrl]);

  const hotspotsSig = JSON.stringify(
    hotspots.map((h) => [h._id, h.pitch, h.yaw, h.type, h.text, h.scale ?? 1, h.spaceCode ?? ""])
  );
  const spacesSig = spaces.map((s) => `${s.code}:${s.status}`).join("|");
  const blursSig = JSON.stringify(
    privacyBlurs.map((b) => [b._id, b.pitch, b.yaw, b.width, b.height, b.intensity, b.scale ?? 1])
  );

  useEffect(() => {
    if (!viewerReadyRef.current || !viewerRef.current) return;
    syncAllOverlays(viewerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspotsSig, blursSig, spacesSig, syncAllOverlays]);

  const scaleSig = hotspots.map((h) => `${h._id}:${h.scale ?? 1}`).join("|");
  useEffect(() => {
    if (!viewerReadyRef.current) return;
    for (const h of hotspots) {
      const div = hotspotDomRef.current.get(h._id);
      if (div) setHotspotScale(div, h.scale);
    }
  }, [scaleSig, hotspots]);

  const blurDimSig = privacyBlurs
    .map((b) => `${b._id}:${b.width}:${b.height}:${b.intensity}:${b.scale ?? 1}`)
    .join("|");
  useEffect(() => {
    if (!viewerReadyRef.current) return;
    for (const b of privacyBlurs) {
      const div = blurDomRef.current.get(b._id);
      if (div) setPrivacyBlurDimensions(div, b, true);
    }
  }, [blurDimSig, privacyBlurs]);

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
    const onPointerDown = (e: PointerEvent) => {
      if (addModeRef.current === "none") return;
      if ((e.target as Element).closest(".lrt-editor-hs, .lrt-editor-blur")) return;
      pointerRef.current = { kind: "add", x: e.clientX, y: e.clientY, moved: false };
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = pointerRef.current;
      if (!p) return;
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
      pointerRef.current = null;

      if (!p || !viewerRef.current || !viewerReadyRef.current) {
        dragIdRef.current = null;
        setDragging(false);
        return;
      }

      if (p.kind === "add" && addModeRef.current !== "none" && !p.moved) {
        try {
          const coords: [number, number] = viewerRef.current.mouseEventToCoords(e);
          const yaw = roundCoord(coords[1]);
          const pitch = roundCoord(coords[0]);
          if (addModeRef.current === "blur") onBlurAddRef.current(yaw, pitch);
          else onAddRef.current(yaw, pitch);
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

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const addModeLabel =
    addMode === "scene"
      ? "scene"
      : addMode === "space"
        ? "unit komersial"
        : addMode === "info"
          ? "info"
          : addMode === "blur"
            ? "blur privasi"
            : "";

  return (
    <div className="cms-vt-panorama relative h-full min-h-0 w-full overflow-hidden overscroll-none select-none">
      <div ref={containerRef} className="absolute inset-0" style={{ background: "#0f172a" }} />

      {dragging && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-amber-500/60 text-amber-300 text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <span className="text-base">✥</span>
            Lepas untuk menetapkan posisi baru
          </div>
        </div>
      )}

      {addMode !== "none" && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 text-sm px-5 py-2.5 rounded-full pointer-events-none flex items-center gap-2 shadow-lg z-20 backdrop-blur border ${
            addMode === "blur"
              ? "bg-slate-900/95 border-purple-500/70 text-purple-300"
              : "bg-slate-900/95 border-emerald-500/70 text-emerald-300"
          }`}
        >
          <span className="text-base">
            {addMode === "scene" ? "🔀" : addMode === "space" ? "🏪" : addMode === "info" ? "ℹ️" : "🫥"}
          </span>
          Klik (tanpa drag) untuk pasang <strong>{addModeLabel}</strong>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex items-center gap-3 pointer-events-none z-20">
        <div className="bg-slate-900/80 backdrop-blur text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          Edit 3D — drag untuk lihat sekeliling
        </div>
        <div className="bg-slate-900/80 backdrop-blur text-slate-500 text-xs px-2.5 py-1.5 rounded-full border border-slate-700">
          {hotspots.length} hotspot · {privacyBlurs.length} blur
        </div>
      </div>

      {!panoramaUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-500 z-30">
          <div className="text-5xl mb-3">🌐</div>
          <p className="text-sm">Upload panorama equirectangular untuk mulai edit</p>
        </div>
      )}
    </div>
  );
}
