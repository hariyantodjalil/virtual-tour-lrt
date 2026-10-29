"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  fragmentToPathD,
  projectPolygonFragments,
  type ProjectedFragment,
} from "@/lib/spatial/geometry/clipping";
import { projectPoint } from "@/lib/spatial/geometry/projection";
import {
  startCameraSync,
  type PannellumViewerLike,
} from "@/lib/spatial/pannellum-adapter";
import { spatialAreaBadgeCaption } from "@/lib/spatial/normalize";
import { spatialUnitInteractionKeys } from "@/lib/spatial/unit-groups";
import { validateSphericalPolygonAuthoring } from "@/lib/spatial/geometry/polygon-validation";
import { dirToSpherical, slerpDir, sphericalToDir } from "@/lib/spatial/geometry/spherical";
import type { CameraState, SpatialEntity, SphericalPoint } from "@/lib/spatial/types";
import { DEFAULT_SPATIAL_STYLE } from "@/lib/spatial/types";
import {
  spaceStatusColor,
  spaceStatusCssVariant,
  type SpaceAvailabilityStatus,
} from "@/lib/space-availability";

type Props = {
  viewer: PannellumViewerLike | null;
  container: HTMLElement | null;
  entities: SpatialEntity[];
  draftVertices?: SphericalPoint[];
  selectedId?: string | null;
  interactive?: boolean;
  resolveSpaceStatus?: (spaceCode: string) => SpaceAvailabilityStatus | undefined;
  onSelect?: (id: string | null) => void;
  onEntityClick?: (entity: SpatialEntity) => void;
  onGeometryCommit?: (id: string, vertices: SphericalPoint[]) => void;
  onEditError?: (message: string) => void;
  onCloseDraft?: () => void;
};

/** Keep a unit badge above the horizontal center of its visible geometry. */
function badgeAnchor(fragments: ProjectedFragment[]): { x: number; y: number } | null {
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  for (const frag of fragments) {
    for (const p of frag.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
    }
  }
  if (!Number.isFinite(minY)) return null;
  return { x: (minX + maxX) / 2, y: Math.max(24, minY - 26) };
}

function pillColors(status?: SpaceAvailabilityStatus) {
  const variant = spaceStatusCssVariant(status);
  if (variant === "available") {
    return { bg: "#FFFFFF", ink: "#166C4A", ring: "#A2DAC0" };
  }
  if (variant === "occupied") {
    return { bg: "#FFFFFF", ink: "#9F1239", ring: "#F3C3C3" };
  }
  if (variant === "maintenance") {
    return { bg: "#FFFFFF", ink: "#52616C", ring: "#D5DDE3" };
  }
  return { bg: "#FFFFFF", ink: "#52616C", ring: "#D5DDE3" };
}

class SpatialOverlayBoundary extends Component<{ children: ReactNode; sceneId: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    console.error({ code: "SPATIAL_RENDER_FAILED", sceneId: this.props.sceneId });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SpatialOverlay(props: Props) {
  const sceneId = props.entities[0]?.sceneId ?? "";
  return <SpatialOverlayBoundary key={sceneId} sceneId={sceneId}><SpatialOverlayContent {...props} /></SpatialOverlayBoundary>;
}

function SpatialOverlayContent({
  viewer,
  container,
  entities,
  draftVertices = [],
  selectedId = null,
  interactive = false,
  resolveSpaceStatus,
  onSelect,
  onEntityClick,
  onGeometryCommit,
  onEditError,
  onCloseDraft,
}: Props) {
  const [camera, setCamera] = useState<CameraState | null>(null);
  const hasGeometry = entities.some((entity) => entity.enabled) || draftVertices.length > 0;
  const [hoveredUnitKey, setHoveredUnitKey] = useState<string | null>(null);
  const unitKeys = useMemo(() => spatialUnitInteractionKeys(entities), [entities]);
  const [drag, setDrag] = useState<{
    id: string;
    index: number;
    vertices: SphericalPoint[];
  } | null>(null);

  useEffect(() => {
    if (!drag) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDrag(null);
      }
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [drag]);

  function commitGeometry(id: string, vertices: SphericalPoint[]) {
    const result = validateSphericalPolygonAuthoring(vertices);
    if (result.ok) onGeometryCommit?.(id, result.vertices);
    else onEditError?.(result.reason);
  }

  useEffect(() => {
    if (!hasGeometry) return;
    return startCameraSync({
      getViewer: () => viewer,
      getContainer: () => container,
      onFrame: (next) => flushSync(() => setCamera(next)),
    });
  }, [viewer, container, hasGeometry]);

  const width = camera?.widthCssPx ?? 0;
  const height = camera?.heightCssPx ?? 0;

  const rendered = useMemo(() => {
    if (!camera || width < 1 || height < 1) return [];
    return entities
      .filter(
        (e) =>
          e.enabled && e.kind === "SPATIAL_AREA" && e.geometry.type === "spherical_polygon"
      )
      .map((entity) => {
        const verts = drag?.id === entity.id
          ? drag.vertices
          : entity.geometry.type === "spherical_polygon" ? entity.geometry.vertices : [];
        const fragments = projectPolygonFragments(verts, camera);
        const handles =
          entity.id === selectedId
            ? verts.flatMap((v, index) => {
                const point = projectPoint(v, camera);
                return point ? [{ ...point, index }] : [];
              })
            : [];
        const midpoints = entity.id === selectedId && verts.length < 64
          ? verts.flatMap((v, index) => {
              const next = verts[(index + 1) % verts.length];
              const spherical = dirToSpherical(slerpDir(sphericalToDir(v), sphericalToDir(next), 0.5));
              const point = projectPoint(spherical, camera);
              return point ? [{ ...point, spherical, index }] : [];
            })
          : [];
        return { entity, verts, fragments, anchor: badgeAnchor(fragments), handles, midpoints };
      })
      .filter((r) => r.fragments.length > 0);
  }, [camera, entities, width, height, selectedId, drag]);

  const unitBadges = useMemo(() => {
    const groups = new Map<string, { ownerId: string | null; fragments: ProjectedFragment[] }>();
    for (const row of rendered) {
      const key = unitKeys.get(row.entity.id) ?? `area:${row.entity.id}`;
      let group = groups.get(key);
      if (!group) { group = { ownerId: null, fragments: [] }; groups.set(key, group); }
      group.fragments.push(...row.fragments);
      if (group.ownerId === null && row.entity.style.showLabel !== false) group.ownerId = row.entity.id;
    }
    return new Map([...groups].map(([key, group]) => [key, { ownerId: group.ownerId, anchor: badgeAnchor(group.fragments) }]));
  }, [rendered, unitKeys]);

  const draftPreview = useMemo(() => {
    if (!camera || draftVertices.length < 1) {
      return { paths: [] as string[], handles: [] as { x: number; y: number }[] };
    }
    const handles = draftVertices
      .map((v) => projectPoint(v, camera))
      .filter(Boolean) as { x: number; y: number }[];

    if (draftVertices.length >= 3) {
      return {
        paths: projectPolygonFragments(draftVertices, camera).map(fragmentToPathD),
        handles,
      };
    }
    if (handles.length < 2) return { paths: [], handles };
    let d = `M ${handles[0].x.toFixed(2)} ${handles[0].y.toFixed(2)}`;
    for (let i = 1; i < handles.length; i++) {
      d += ` L ${handles[i].x.toFixed(2)} ${handles[i].y.toFixed(2)}`;
    }
    return { paths: [d], handles };
  }, [camera, draftVertices]);

  if (!camera || width < 1 || height < 1) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[15] h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden={!interactive}
    >
      <defs>
        <filter id="spatial-seal-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#4ADE80" floodOpacity="0.55" />
        </filter>
      </defs>

      {rendered.map(({ entity, verts, fragments, anchor, handles, midpoints }) => {
        const style = { ...DEFAULT_SPATIAL_STYLE, ...entity.style };
        const unitKey = unitKeys.get(entity.id) ?? `area:${entity.id}`;
        const badge = unitBadges.get(unitKey);
        const selected = entity.id === selectedId;
        const outlineOnly = style.outlineOnly !== false;
        const baseFill = style.fillOpacity ?? 0.1;
        const hovered = interactive && unitKey === hoveredUnitKey;
        let fillOp = outlineOnly
          ? selected
            ? Math.max(baseFill, 0.14)
            : baseFill
          : selected
            ? Math.min(1, (style.hoverFillOpacity ?? 0.18) + 0.05)
            : baseFill;
        if (hovered) {
          fillOp = Math.min(1, Math.max(fillOp, style.hoverFillOpacity ?? 0.18));
        }
        const strokeW = (style.strokeWidthPx ?? 2.5) + (selected ? 1 : hovered ? 0.75 : 0);
        const status = entity.spaceCode
          ? resolveSpaceStatus?.(entity.spaceCode)
          : undefined;
        const stroke =
          style.strokeColor ??
          (status ? spaceStatusColor(status) : "#4ADE80");
        const fill = style.fillColor ?? stroke;
        const caption = spatialAreaBadgeCaption(entity, status);
        const pill = pillColors(status);
        const approxCharW = 7.2;
        const maxPillW = Math.max(80, Math.min(360, width - 16));
        const maxChars = Math.max(3, Math.floor((maxPillW - 50) / approxCharW));
        const displayCaption = caption.length > maxChars ? `${caption.slice(0, maxChars - 1)}…` : caption;
        const pillW = Math.min(maxPillW, Math.max(120, displayCaption.length * approxCharW + 50));
        const pillH = 32;

        const onHit = interactive
          ? (e: { stopPropagation: () => void; preventDefault: () => void }) => {
              e.stopPropagation();
              e.preventDefault();
              onSelect?.(entity.id);
              onEntityClick?.(entity);
            }
          : undefined;
        /** Stroke visual tipis (~2–4px) — hit area terpisah biar gampang diklik. */
        const hitStroke = Math.max(28, strokeW + 20);

        return (
          <g key={entity.id} data-spatial-entity={entity.id} data-spatial-group={unitKey} style={{ transition: "opacity 160ms ease-out" }}>
            {fragments.map((frag, i) => {
              // Keep every clipped vertex while avoiding per-frame path-data style updates.
              const points = frag.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
              return (
                <g key={`${entity.id}-${i}`}>
                  {/* Invisible hit target: isi polygon + stroke lebar */}
                  {interactive && (
                    <polygon
                      points={points}
                      fill={fill}
                      fillOpacity={0.001}
                      stroke={stroke}
                      strokeOpacity={0.001}
                      strokeWidth={hitStroke}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      pointerEvents="visiblePainted"
                      className="spatial-hit pointer-events-auto cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={caption}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onHit?.(e);
                      }}
                      onPointerEnter={() => setHoveredUnitKey(unitKey)}
                      onPointerLeave={() =>
                        setHoveredUnitKey((key) => (key === unitKey ? null : key))
                      }
                      onFocus={() => setHoveredUnitKey(unitKey)}
                      onBlur={() => setHoveredUnitKey((key) => key === unitKey ? null : key)}
                      onClick={onHit}
                    />
                  )}
                  <polygon
                    points={points}
                    fill="none"
                    stroke="#052e16"
                    strokeOpacity={0.55}
                    strokeWidth={strokeW + 2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                  <polygon
                    points={points}
                    fill={fill}
                    fillOpacity={fillOp}
                    stroke={stroke}
                    strokeOpacity={hovered ? 1 : style.strokeOpacity ?? 1}
                    strokeWidth={strokeW}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    filter={selected || hovered ? "url(#spatial-seal-glow)" : undefined}
                    className={`pointer-events-none spatial-area-fill${selected ? " is-selected" : ""}${hovered ? " is-hovered" : ""}`}
                    style={{ transition: "fill-opacity 160ms ease-out, filter 160ms ease-out" }}
                  />
                </g>
              );
            })}

            {badge?.ownerId === entity.id && badge.anchor && (
              <g
                transform={`translate(${Math.max(pillW / 2 + 8, Math.min(width - pillW / 2 - 8, badge.anchor.x))}, ${badge.anchor.y})`}
                className={
                  interactive
                    ? "spatial-badge pointer-events-auto cursor-pointer"
                    : "spatial-badge"
                }
                onPointerEnter={
                  interactive ? () => setHoveredUnitKey(unitKey) : undefined
                }
                onPointerLeave={
                  interactive
                    ? () => setHoveredUnitKey((key) => (key === unitKey ? null : key))
                    : undefined
                }
                onClick={onHit}
              >
                <title>{caption}</title>
                {/* Perluas hit badge */}
                {interactive && (
                  <rect
                    x={-pillW / 2 - 6}
                    y={-pillH / 2 - 6}
                    width={pillW + 12}
                    height={pillH + 12}
                    rx={8}
                    fill="transparent"
                  />
                )}
                <rect
                  x={-pillW / 2}
                  y={-pillH / 2}
                  width={pillW}
                  height={pillH}
                  rx={10}
                  ry={10}
                  fill={pill.bg}
                  stroke={pill.ring}
                  strokeWidth={1.25}
                  opacity={1}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  x={-12}
                  fill={pill.ink}
                  fontSize={12}
                  fontWeight={800}
                  letterSpacing="0.02em"
                  style={{ fontFamily: "Chakra Petch, system-ui, sans-serif" }}
                >
                  {displayCaption}
                </text>
                <text x={pillW / 2 - 18} textAnchor="middle" dominantBaseline="central" fill={pill.ink} fontSize={16} fontWeight={800} aria-hidden="true">↘</text>
              </g>
            )}

            {selected && interactive && onGeometryCommit && midpoints.map((h) => (
              <circle
                key={`mid-${h.index}`}
                cx={h.x} cy={h.y} r={4}
                fill="#22D3EE" stroke="#082F49" strokeWidth={1}
                className="pointer-events-auto cursor-copy"
                role="button" tabIndex={0} aria-label={`Tambah titik setelah titik ${h.index + 1}`}
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  commitGeometry(entity.id, [...verts.slice(0, h.index + 1), h.spherical, ...verts.slice(h.index + 1)]);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault(); e.stopPropagation();
                    commitGeometry(entity.id, [...verts.slice(0, h.index + 1), h.spherical, ...verts.slice(h.index + 1)]);
                  }
                }}
              />
            ))}
            {selected && interactive &&
              handles.map((h) => (
                <circle
                  key={`sh-${entity.id}-${h.index}`}
                  cx={h.x}
                  cy={h.y}
                  r={6}
                  fill="#F8ECEE"
                  stroke={stroke}
                  strokeWidth={1.5}
                  className={onGeometryCommit ? "pointer-events-auto cursor-move" : undefined}
                  role={onGeometryCommit ? "button" : undefined}
                  tabIndex={onGeometryCommit ? 0 : undefined}
                  aria-label={`Titik ${h.index + 1}. Geser dengan panah, Delete menghapus, Escape membatalkan drag.`}
                  onPointerDown={(e) => {
                    if (!onGeometryCommit) return;
                    e.preventDefault(); e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({ id: entity.id, index: h.index, vertices: verts });
                  }}
                  onPointerMove={(e) => {
                    if (!drag || drag.id !== entity.id) return;
                    e.stopPropagation();
                    const coords = viewer?.mouseEventToCoords?.(e.nativeEvent);
                    if (!coords || !coords.every(Number.isFinite)) return;
                    const [pitch, yaw] = coords;
                    setDrag((current) => current ? {
                      ...current,
                      vertices: current.vertices.map((v, i) => i === current.index ? { yaw, pitch } : v),
                    } : null);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    if (drag) commitGeometry(drag.id, drag.vertices);
                    setDrag(null);
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  onLostPointerCapture={() => setDrag(null)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (!onGeometryCommit) return;
                    if (e.key === "Delete" || e.key === "Backspace") {
                      e.preventDefault(); e.stopPropagation();
                      if (verts.length <= 3) onEditError?.("Polygon harus memiliki minimal 3 titik.");
                      else commitGeometry(entity.id, verts.filter((_, i) => i !== h.index));
                    } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                      e.preventDefault(); e.stopPropagation();
                      const step = e.shiftKey ? 1 : 0.25;
                      commitGeometry(entity.id, verts.map((v, i) => i !== h.index ? v : {
                        yaw: v.yaw + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0),
                        pitch: v.pitch + (e.key === "ArrowDown" ? -step : e.key === "ArrowUp" ? step : 0),
                      }));
                    }
                  }}
                />
              ))}

            {style.showBoundaryHint && anchor && (
              <text
                x={anchor.x}
                y={Math.min(height - 8, anchor.y + 26)}
                textAnchor="middle"
                fill={stroke}
                fillOpacity={0.85}
                fontSize={9}
                fontWeight={600}
                style={{ fontFamily: "Source Sans 3, system-ui, sans-serif" }}
              >
                Boundary Indicative*
              </text>
            )}
          </g>
        );
      })}

      {draftPreview.paths.map((d, i) => (
        <path
          key={`draft-${i}`}
          d={d}
          fill={draftVertices.length >= 3 ? "rgba(74,222,128,0.1)" : "none"}
          stroke="#4ADE80"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeDasharray={draftVertices.length >= 3 ? undefined : "5 4"}
          filter={draftVertices.length >= 3 ? "url(#spatial-seal-glow)" : undefined}
        />
      ))}
      {draftPreview.handles.map((h, i) => (
        <circle
          key={`dh-${i}`}
          cx={h.x}
          cy={h.y}
          r={5}
          fill="#F8ECEE"
          stroke="#4ADE80"
          strokeWidth={1.5}
          className={i === 0 && draftVertices.length >= 3 ? "pointer-events-auto cursor-pointer" : undefined}
          onPointerDown={i === 0 && draftVertices.length >= 3 ? (e) => {
            e.preventDefault(); e.stopPropagation(); onCloseDraft?.();
          } : undefined}
        />
      ))}
    </svg>
  );
}
