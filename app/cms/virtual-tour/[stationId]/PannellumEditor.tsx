"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import type { AddMode, HotspotItem } from "@/lib/hotspot-types";
import {
  applyHotspotBaseStyle,
  attachHotspotTooltip,
  setHotspotSelected,
} from "@/lib/pannellum-hotspot";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pannellum: any;
  }
}

const DRAG_THRESHOLD_PX = 6;
const ADD_CLICK_THRESHOLD_PX = 8;

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
  onPointerDownRef: React.MutableRefObject<(id: string, e: PointerEvent) => void>,
  onDeleteRef: React.MutableRefObject<(id: string) => void>
) {
  applyHotspotBaseStyle(div, { type: h.type, label: h.text, selected: isSelected });
  attachHotspotTooltip(div, h.text || h.type);

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.innerHTML =
    '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  Object.assign(delBtn.style, {
    position: "absolute",
    top: "-7px",
    right: "-7px",
    width: "19px",
    height: "19px",
    borderRadius: "50%",
    background: "#ef4444",
    border: "2px solid white",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: "20",
    boxShadow: "0 2px 5px rgba(0,0,0,0.45)",
    padding: "0",
  });
  div.appendChild(delBtn);

  div.addEventListener("mouseenter", () => { delBtn.style.display = "flex"; });
  div.addEventListener("mouseleave", () => { delBtn.style.display = "none"; });

  div.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onPointerDownRef.current(h._id, e);
  });

  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onDeleteRef.current(h._id);
  });

  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteRef.current(h._id);
  });
}

interface Props {
  panoramaUrl: string;
  hotspots: HotspotItem[];
  selectedId: string | null;
  addMode: AddMode;
  onHotspotAdd: (yaw: number, pitch: number) => void;
  onHotspotMove: (id: string, yaw: number, pitch: number) => void;
  onHotspotSelect: (id: string | null) => void;
  onHotspotDelete: (id: string) => void;
}

export function PannellumEditor({
  panoramaUrl,
  hotspots,
  selectedId,
  addMode,
  onHotspotAdd,
  onHotspotMove,
  onHotspotSelect,
  onHotspotDelete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const viewerReadyRef = useRef(false);
  const mountedHotspotIdsRef = useRef<string[]>([]);
  const hotspotDomRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const hotspotTypeRef = useRef<Map<string, HotspotItem["type"]>>(new Map());
  const hotspotsRef = useRef(hotspots);

  const onSelectRef = useRef(onHotspotSelect);
  const onDeleteRef = useRef(onHotspotDelete);
  const onAddRef = useRef(onHotspotAdd);
  const onMoveRef = useRef(onHotspotMove);
  const addModeRef = useRef(addMode);

  useEffect(() => {
    hotspotsRef.current = hotspots;
  }, [hotspots]);

  useEffect(() => {
    onSelectRef.current = onHotspotSelect;
    onDeleteRef.current = onHotspotDelete;
    onAddRef.current = onHotspotAdd;
    onMoveRef.current = onHotspotMove;
    addModeRef.current = addMode;
  }, [addMode, onHotspotAdd, onHotspotDelete, onHotspotMove, onHotspotSelect]);

  const [dragging, setDragging] = useState(false);
  const pointerRef = useRef<{
    kind: "add" | "hotspot";
    id?: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const onPointerDownHotspot = useCallback((id: string, e: PointerEvent) => {
    if (addModeRef.current !== "none") return;
    pointerRef.current = { kind: "hotspot", id, x: e.clientX, y: e.clientY, moved: false };
    dragIdRef.current = null;
    setDragging(false);
  }, []);

  const onPointerDownHotspotRef = useRef(onPointerDownHotspot);

  useEffect(() => {
    onPointerDownHotspotRef.current = onPointerDownHotspot;
  }, [onPointerDownHotspot]);

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
            cssClass: "lrt-editor-hs",
            createTooltipFunc: (div: HTMLDivElement) => {
              hotspotDomRef.current.set(h._id, div);
              hotspotTypeRef.current.set(h._id, h.type);
              buildEditorHotspotEl(div, h, false, onPointerDownHotspotRef, onDeleteRef);
            },
          });
          mountedHotspotIdsRef.current.push(h._id);
        } catch { /* ignore */ }
      }
    },
    []
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
          hotSpots: [],
        });

        viewerRef.current.on("load", () => {
          viewerReadyRef.current = true;
          syncHotspots(viewerRef.current, hotspotsRef.current);
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
      hotspotDomRef.current.clear();
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panoramaUrl]);

  // Sync hotspot positions — hanya saat data hotspot berubah, bukan selection
  const hotspotsSig = JSON.stringify(
    hotspots.map((h) => [h._id, h.pitch, h.yaw, h.type, h.text])
  );
  useEffect(() => {
    if (!viewerReadyRef.current || !viewerRef.current) return;
    syncHotspots(viewerRef.current, hotspots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspotsSig, syncHotspots]);

  // Update selection visual tanpa re-mount hotspot
  useEffect(() => {
    hotspotDomRef.current.forEach((div, id) => {
      const type = hotspotTypeRef.current.get(id) ?? "scene";
      setHotspotSelected(div, type, id === selectedId);
    });
  }, [selectedId]);

  // Pointer: add hotspot (klik tanpa drag) + drag hotspot
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (addModeRef.current === "none") return;
      if ((e.target as Element).closest(".lrt-editor-hs")) return;
      pointerRef.current = { kind: "add", x: e.clientX, y: e.clientY, moved: false };
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = pointerRef.current;
      if (!p) return;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (dist <= DRAG_THRESHOLD_PX) return;
      p.moved = true;

      if (p.kind === "hotspot" && p.id && !dragIdRef.current) {
        dragIdRef.current = p.id;
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
          onAddRef.current(roundCoord(coords[1]), roundCoord(coords[0]));
        } catch { /* ignore */ }
      } else if (p.kind === "hotspot" && p.id) {
        if (dragIdRef.current === p.id) {
          try {
            const coords: [number, number] = viewerRef.current.mouseEventToCoords(e);
            onMoveRef.current(p.id, roundCoord(coords[1]), roundCoord(coords[0]));
          } catch { /* ignore */ }
        } else if (!p.moved) {
          onSelectRef.current(p.id);
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
    addMode === "scene" ? "scene" : addMode === "space" ? "unit komersial" : addMode === "info" ? "info" : "";

  return (
    <div className="cms-vt-panorama relative h-full min-h-0 w-full overflow-hidden overscroll-none select-none">
      <div ref={containerRef} className="absolute inset-0" style={{ background: "#0f172a" }} />

      {dragging && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-amber-500/60 text-amber-300 text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <span className="text-base">✥</span>
            Lepas untuk menetapkan posisi baru hotspot
          </div>
        </div>
      )}

      {addMode !== "none" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur border border-emerald-500/70 text-emerald-300 text-sm px-5 py-2.5 rounded-full pointer-events-none flex items-center gap-2 shadow-lg z-20">
          <span className="text-base">{addMode === "scene" ? "🔀" : addMode === "space" ? "🏪" : "ℹ️"}</span>
          Klik (tanpa drag) untuk pasang hotspot <strong>{addModeLabel}</strong>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex items-center gap-3 pointer-events-none z-20">
        <div className="bg-slate-900/80 backdrop-blur text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          Edit 3D — drag untuk lihat sekeliling
        </div>
        <div className="bg-slate-900/80 backdrop-blur text-slate-500 text-xs px-2.5 py-1.5 rounded-full border border-slate-700">
          {hotspots.length} hotspot
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
