"use client";

import { useId, type MouseEvent } from "react";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import {
  viewConePoints,
  viewConeRadius,
  type LevelMinimap,
  type MinimapPoint,
} from "@/lib/minimap";

export type MinimapSceneLabel = { sceneId: string; title: string };

type Props = {
  minimap: LevelMinimap;
  scenes: MinimapSceneLabel[];
  activeSceneId: string | null;
  view: { yaw: number; hfov: number } | null;
  onSelectScene?: (sceneId: string) => void;
  /** Klik di area denah (koordinat piksel gambar) — dipakai editor CMS. */
  onCanvasClick?: (point: MinimapPoint) => void;
  /** Tampilkan garis kalibrasi lantai (editor). */
  showCalibration?: boolean;
  /** Titik sementara saat admin menandai sudut lantai. */
  draftCorners?: MinimapPoint[];
  crosshair?: boolean;
  className?: string;
};

/** Gambar denah + pin scene + kerucut pandang. Dipakai di tur publik dan editor CMS. */
export default function MinimapCanvas({
  minimap,
  scenes,
  activeSceneId,
  view,
  onSelectScene,
  onCanvasClick,
  showCalibration = false,
  draftCorners,
  crosshair = false,
  className = "",
}: Props) {
  const clipId = useId();
  const { width, height } = minimap;
  const unit = Math.max(width, height);
  const pinR = unit * 0.011;
  const activePin = activeSceneId ? minimap.pins[activeSceneId] : undefined;
  const cone =
    activePin && view ? viewConePoints(minimap, activePin, view.yaw, view.hfov, viewConeRadius(minimap)) : null;
  const titles = new Map(scenes.map((scene) => [scene.sceneId, scene.title]));
  const corners = draftCorners ?? minimap.corners;

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    if (!onCanvasClick) return;
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    onCanvasClick({ x: Math.round(point.x), y: Math.round(point.y) });
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`block h-auto w-full select-none ${crosshair ? "cursor-crosshair" : ""} ${className}`}
      onClick={handleClick}
      role="img"
      aria-label="Denah minimap"
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={width} height={height} />
        </clipPath>
      </defs>
      <image href={getS3ProxyUrl(minimap.imageUrl)} width={width} height={height} preserveAspectRatio="xMidYMid meet" />

      <g clipPath={`url(#${clipId})`}>
        {showCalibration && corners && corners.length > 0 ? (
          <g pointerEvents="none">
            {corners.length === 3 ? (
              <polygon
                points={[
                  corners[0],
                  corners[1],
                  { x: corners[1].x + corners[2].x - corners[0].x, y: corners[1].y + corners[2].y - corners[0].y },
                  corners[2],
                ]
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="rgba(14,165,233,0.08)"
                stroke="#0ea5e9"
                strokeWidth={unit * 0.003}
                strokeDasharray={`${unit * 0.01} ${unit * 0.006}`}
              />
            ) : null}
            {corners.map((corner, index) => (
              <g key={index}>
                <circle cx={corner.x} cy={corner.y} r={pinR * 0.8} fill="#0ea5e9" stroke="#fff" strokeWidth={unit * 0.003} />
                <text
                  x={corner.x}
                  y={corner.y - pinR * 1.4}
                  textAnchor="middle"
                  fontSize={unit * 0.022}
                  fontWeight={700}
                  fill="#0369a1"
                  stroke="#fff"
                  strokeWidth={unit * 0.004}
                  paintOrder="stroke"
                >
                  {index === 0 ? "Sudut" : index === 1 ? "Sisi 1" : "Sisi 2"}
                </text>
              </g>
            ))}
          </g>
        ) : null}

        {cone ? <polygon points={cone} fill="rgba(196,18,48,0.32)" stroke="rgba(196,18,48,0.75)" strokeWidth={unit * 0.002} pointerEvents="none" /> : null}

        {Object.entries(minimap.pins).map(([sceneId, pin]) => {
          const active = sceneId === activeSceneId;
          const title = titles.get(sceneId) ?? sceneId;
          return (
            <g
              key={sceneId}
              className={onSelectScene && !active ? "cursor-pointer" : undefined}
              onClick={(event) => {
                if (!onSelectScene) return;
                event.stopPropagation();
                if (!active) onSelectScene(sceneId);
              }}
            >
              <title>{title}</title>
              {active ? (
                <circle cx={pin.x} cy={pin.y} r={pinR * 2.2} fill="rgba(196,18,48,0.18)" className="minimap-pulse" />
              ) : null}
              {/* Area klik lebih besar dari titik agar mudah disentuh di ponsel. */}
              <circle cx={pin.x} cy={pin.y} r={pinR * 2.4} fill="transparent" />
              <circle
                cx={pin.x}
                cy={pin.y}
                r={active ? pinR * 1.15 : pinR}
                fill={active ? "#c41230" : "#ffffff"}
                stroke={active ? "#ffffff" : "#1e293b"}
                strokeWidth={unit * (active ? 0.004 : 0.003)}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
