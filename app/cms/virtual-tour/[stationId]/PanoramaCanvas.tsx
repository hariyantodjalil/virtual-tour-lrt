"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { getS3ProxyUrl } from "@/lib/s3-utils";

// SVG coordinate space — represents full equirectangular (2:1)
export const PANO_W = 3600;
export const PANO_H = 1800;

export type AddMode = "none" | "scene" | "space";

export type HotspotItem = {
  _id: string; // temp UI id, stripped before saving
  pitch: number;
  yaw: number;
  type: "scene" | "space";
  text: string;
  sceneId?: string;
  spaceCode?: string;
};

export function hotspotToXY(h: { yaw: number; pitch: number }) {
  return {
    x: ((h.yaw + 180) / 360) * PANO_W,
    y: ((90 - h.pitch) / 180) * PANO_H,
  };
}

export function xyToCoords(x: number, y: number) {
  const yaw = Math.round(((x / PANO_W) * 360 - 180) * 10) / 10;
  const pitch = Math.round(((90 - (y / PANO_H) * 180) * 10)) / 10;
  return {
    yaw: Math.max(-180, Math.min(180, yaw)),
    pitch: Math.max(-90, Math.min(90, pitch)),
  };
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

export function PanoramaCanvas({
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
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoom, setZoom] = useState(50);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const isPanningRef = useRef(false);
  const lastPtrRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [contextMenu, setContextMenu] = useState<{
    id: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Center content on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const initialZoom = Math.min(
      (el.clientWidth / PANO_W) * 100,
      (el.clientHeight / PANO_H) * 100,
      100
    );
    const z = Math.max(20, initialZoom * 0.9);
    const cw = PANO_W * (z / 100);
    const ch = PANO_H * (z / 100);
    setZoom(z);
    setPan({ x: (el.clientWidth - cw) / 2, y: (el.clientHeight - ch) / 2 });
  }, []); // eslint-disable-line

  const pixelToSVG = useCallback((px: number, py: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = px;
    pt.y = py;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // Wheel zoom — centered
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => {
        const next = Math.max(15, Math.min(400, z - e.deltaY * 0.05));
        const cw = PANO_W * (next / 100);
        const ch = PANO_H * (next / 100);
        const cel = containerRef.current;
        if (cel) setPan({ x: (cel.clientWidth - cw) / 2, y: (cel.clientHeight - ch) / 2 });
        return next;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as Element;
      const isBackground =
        target === containerRef.current ||
        target.tagName === "image" ||
        target.tagName === "svg" ||
        target.classList.contains("pano-bg");

      if (isBackground) {
        isPanningRef.current = true;
        lastPtrRef.current = { x: e.clientX, y: e.clientY };
        didDragRef.current = false;
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingId) {
        const svgCoords = pixelToSVG(e.clientX, e.clientY);
        const x = svgCoords.x - dragOffset.x;
        const y = svgCoords.y - dragOffset.y;
        const { yaw, pitch } = xyToCoords(x, y);
        onHotspotMove(draggingId, yaw, pitch);
        didDragRef.current = true;
      } else if (isPanningRef.current && lastPtrRef.current) {
        const dx = e.clientX - lastPtrRef.current.x;
        const dy = e.clientY - lastPtrRef.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true;
        lastPtrRef.current = { x: e.clientX, y: e.clientY };
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
    },
    [draggingId, dragOffset, onHotspotMove, pixelToSVG]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
    isPanningRef.current = false;
    lastPtrRef.current = null;
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      if (didDragRef.current) return;
      const target = e.target as Element;
      const isBackground =
        target === containerRef.current ||
        target.tagName === "image" ||
        target.tagName === "svg" ||
        target.classList.contains("pano-bg");

      if (!isBackground) return;

      if (addMode !== "none") {
        const svgCoords = pixelToSVG(e.clientX, e.clientY);
        const { yaw, pitch } = xyToCoords(svgCoords.x, svgCoords.y);
        onHotspotAdd(yaw, pitch);
      } else {
        onHotspotSelect(null);
      }
    },
    [addMode, contextMenu, onHotspotAdd, onHotspotSelect, pixelToSVG]
  );

  const handleHotspotMouseDown = useCallback(
    (e: React.MouseEvent, h: HotspotItem) => {
      e.stopPropagation();
      if (addMode !== "none") return;
      didDragRef.current = false;
      onHotspotSelect(h._id);
      const svgCoords = pixelToSVG(e.clientX, e.clientY);
      const pos = hotspotToXY(h);
      setDraggingId(h._id);
      setDragOffset({ x: svgCoords.x - pos.x, y: svgCoords.y - pos.y });
    },
    [addMode, onHotspotSelect, pixelToSVG]
  );

  const handleHotspotContextMenu = useCallback(
    (e: React.MouseEvent, h: HotspotItem) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ id: h._id, screenX: e.clientX, screenY: e.clientY });
      onHotspotSelect(h._id);
    },
    [onHotspotSelect]
  );

  function resetView() {
    const el = containerRef.current;
    if (!el) return;
    const z = Math.max(20, Math.min((el.clientWidth / PANO_W) * 100 * 0.9, 100));
    const cw = PANO_W * (z / 100);
    const ch = PANO_H * (z / 100);
    setZoom(z);
    setPan({ x: (el.clientWidth - cw) / 2, y: (el.clientHeight - ch) / 2 });
  }

  const cursor = addMode !== "none" ? "crosshair" : draggingId ? "grabbing" : "default";
  const proxyUrl = panoramaUrl ? getS3ProxyUrl(panoramaUrl) : "";

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-slate-950 select-none"
      style={{ cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* No panorama hint */}
      {!panoramaUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 pointer-events-none z-10">
          <div className="text-5xl mb-3">🌐</div>
          <p className="text-sm">Upload panorama equirectangular untuk mulai</p>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${PANO_W} ${PANO_H}`}
        width={PANO_W}
        height={PANO_H}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
          transformOrigin: "0 0",
          overflow: "visible",
        }}
      >
        {/* Background panorama */}
        {proxyUrl ? (
          <image
            href={proxyUrl}
            x={0}
            y={0}
            width={PANO_W}
            height={PANO_H}
            preserveAspectRatio="none"
            className="pano-bg"
          />
        ) : (
          <rect x={0} y={0} width={PANO_W} height={PANO_H} fill="#1e293b" className="pano-bg" />
        )}

        {/* Equirectangular grid reference */}
        <line x1={PANO_W / 2} y1={0} x2={PANO_W / 2} y2={PANO_H} stroke="white" strokeWidth={2} strokeDasharray="30 15" opacity={0.15} />
        <line x1={0} y1={PANO_H / 2} x2={PANO_W} y2={PANO_H / 2} stroke="white" strokeWidth={2} strokeDasharray="30 15" opacity={0.15} />
        <text x={PANO_W / 2 + 10} y={20} fill="white" fontSize={24} opacity={0.25} dominantBaseline="hanging">0°</text>
        <text x={10} y={20} fill="white" fontSize={24} opacity={0.25} dominantBaseline="hanging">-180°</text>
        <text x={PANO_W - 80} y={20} fill="white" fontSize={24} opacity={0.25} dominantBaseline="hanging">180°</text>

        {/* Hotspot pins */}
        {hotspots.map((h) => {
          const { x, y } = hotspotToXY(h);
          const isScene = h.type === "scene";
          const isSelected = h._id === selectedId;
          const fill = isScene ? "#10b981" : "#f59e0b";
          const strokeColor = isSelected ? "#ffffff" : "rgba(255,255,255,0.8)";

          return (
            <g
              key={h._id}
              transform={`translate(${x}, ${y})`}
              style={{
                cursor: addMode !== "none" ? "crosshair" : draggingId === h._id ? "grabbing" : "grab",
              }}
              onMouseDown={(e) => handleHotspotMouseDown(e, h)}
              onContextMenu={(e) => handleHotspotContextMenu(e, h)}
            >
              {/* Glow when selected */}
              {isSelected && (
                <circle r={36} fill={fill} opacity={0.2} />
              )}

              {/* Pulsing ring for selected */}
              {isSelected && (
                <circle r={28} fill="none" stroke={fill} strokeWidth={3} opacity={0.7} strokeDasharray="10 5" />
              )}

              {/* Shadow */}
              <circle r={20} fill="rgba(0,0,0,0.5)" transform="translate(3,4)" />

              {/* Main pin circle */}
              <circle r={20} fill={fill} stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} />

              {/* Icon */}
              {isScene ? (
                // Arrow for scene
                <path
                  d="M-7 0 L5 0 M1 -6 L7 0 L1 6"
                  stroke="white"
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : (
                // Target for space
                <circle r={7} fill="white" />
              )}

              {/* Label background */}
              <rect
                x={-(h.text.length * 5 + 8) / 2}
                y={26}
                width={h.text.length * 5 + 8}
                height={22}
                rx={4}
                fill="rgba(0,0,0,0.75)"
              />

              {/* Label */}
              <text
                y={41}
                textAnchor="middle"
                fontSize={14}
                fill="white"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {h.text.length > 14 ? h.text.slice(0, 14) + "…" : h.text}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Add mode indicator banner */}
      {addMode !== "none" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur border border-emerald-500/70 text-emerald-300 text-sm px-5 py-2.5 rounded-full pointer-events-none flex items-center gap-2 shadow-lg">
          <span className="text-base">{addMode === "scene" ? "🔀" : "🏪"}</span>
          Klik pada panorama untuk menempatkan hotspot{" "}
          <strong>{addMode === "scene" ? "scene" : "unit komersial"}</strong>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-1.5 shadow-xl">
        <button
          onClick={() => {
            setZoom((z) => {
              const n = Math.max(15, z - 15);
              const el = containerRef.current;
              if (el) setPan({ x: (el.clientWidth - PANO_W * (n / 100)) / 2, y: (el.clientHeight - PANO_H * (n / 100)) / 2 });
              return n;
            });
          }}
          className="w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center font-bold"
          title="Zoom out"
        >
          −
        </button>
        <span className="w-14 text-center text-xs text-slate-400 font-mono">{Math.round(zoom)}%</span>
        <button
          onClick={() => {
            setZoom((z) => {
              const n = Math.min(400, z + 15);
              const el = containerRef.current;
              if (el) setPan({ x: (el.clientWidth - PANO_W * (n / 100)) / 2, y: (el.clientHeight - PANO_H * (n / 100)) / 2 });
              return n;
            });
          }}
          className="w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center font-bold"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px h-5 bg-slate-700 mx-0.5" />
        <button
          onClick={resetView}
          className="px-2.5 h-8 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors text-xs"
        >
          Fit
        </button>
      </div>

      {/* Coordinate display overlay (bottom-left) */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded pointer-events-none">
        {hotspots.length} hotspot{hotspots.length !== 1 ? "s" : ""}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl py-1.5 min-w-[160px]"
            style={{ left: contextMenu.screenX, top: contextMenu.screenY }}
          >
            <div className="px-3 py-1 text-xs text-slate-500 font-medium uppercase tracking-wider border-b border-slate-700 mb-1">
              Hotspot
            </div>
            <button
              className="w-full px-3 py-2 text-sm text-left text-slate-200 hover:bg-slate-700 flex items-center gap-2"
              onClick={() => {
                onHotspotSelect(contextMenu.id);
                setContextMenu(null);
              }}
            >
              <span>✎</span> Edit Properties
            </button>
            <button
              className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-slate-700 flex items-center gap-2"
              onClick={() => {
                onHotspotDelete(contextMenu.id);
                setContextMenu(null);
              }}
            >
              <span>✕</span> Hapus Hotspot
            </button>
          </div>
        </>
      )}
    </div>
  );
}
