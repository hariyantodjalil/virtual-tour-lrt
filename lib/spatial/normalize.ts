import { validateSphericalPolygon } from "./geometry/polygon-validation";
import type { SpatialEntity, SphericalPoint, StyleConfig } from "./types";
import { DEFAULT_SPATIAL_STYLE } from "./types";

const HEX = /^#([0-9a-fA-F]{6})$/;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function sanitizeStyle(raw: unknown): StyleConfig {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: StyleConfig = { ...DEFAULT_SPATIAL_STYLE };
  if (typeof s.fillColor === "string" && HEX.test(s.fillColor)) out.fillColor = s.fillColor;
  if (typeof s.strokeColor === "string" && HEX.test(s.strokeColor)) out.strokeColor = s.strokeColor;
  if (typeof s.fillOpacity === "number" && Number.isFinite(s.fillOpacity)) {
    out.fillOpacity = clamp01(s.fillOpacity);
  }
  if (typeof s.strokeOpacity === "number" && Number.isFinite(s.strokeOpacity)) {
    out.strokeOpacity = clamp01(s.strokeOpacity);
  }
  if (typeof s.hoverFillOpacity === "number" && Number.isFinite(s.hoverFillOpacity)) {
    out.hoverFillOpacity = clamp01(s.hoverFillOpacity);
  }
  if (typeof s.strokeWidthPx === "number" && Number.isFinite(s.strokeWidthPx)) {
    out.strokeWidthPx = Math.max(0.5, Math.min(12, s.strokeWidthPx));
  }
  if (typeof s.showLabel === "boolean") out.showLabel = s.showLabel;
  if (typeof s.labelText === "string") out.labelText = s.labelText.slice(0, 120);
  if (typeof s.outlineOnly === "boolean") out.outlineOnly = s.outlineOnly;
  if (typeof s.badgeLetter === "string" && s.badgeLetter.trim()) {
    out.badgeLetter = s.badgeLetter.trim().slice(0, 2).toUpperCase();
  }
  if (typeof s.showBoundaryHint === "boolean") out.showBoundaryHint = s.showBoundaryHint;
  return out;
}

/** Huruf badge (legacy): style.badgeLetter → label → spaceCode → "U". */
export function spatialBadgeLetter(entity: SpatialEntity): string {
  const fromStyle = entity.style.badgeLetter?.trim();
  if (fromStyle) return fromStyle.slice(0, 2).toUpperCase();
  const fromLabel = (entity.style.labelText || entity.label || "").trim();
  if (fromLabel) return fromLabel[0]!.toUpperCase();
  const code = entity.spaceCode?.trim();
  if (code) return code[0]!.toUpperCase();
  return "U";
}

export type SpatialBadgeStatusHint =
  | "TERSEDIA"
  | "RESERVED"
  | "FIT_OUT"
  | "TERISI"
  | "MAINTENANCE"
  | null
  | undefined;

/** Pill publik/editor: "RUANG TERSEDIA · CODE" (status dari master unit). */
export function spatialAreaBadgeCaption(
  entity: SpatialEntity,
  status?: SpatialBadgeStatusHint
): string {
  const custom = entity.style.labelText?.trim();
  if (custom) return custom;
  const title =
    status === "TERSEDIA"
      ? "RUANG TERSEDIA"
      : status === "TERISI" || status === "RESERVED"
        ? "RUANG TERISI"
        : status === "FIT_OUT" || status === "MAINTENANCE"
          ? "TIDAK AKTIF"
          : entity.spaceCode
            ? "UNIT TIDAK TERSEDIA"
            : (entity.label?.trim() || "SPATIAL AREA");
  const code = entity.spaceCode?.trim();
  return code ? `${title} · ${code}` : title;
}

function asPoint(v: unknown): SphericalPoint | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.yaw !== "number" || typeof o.pitch !== "number") return null;
  if (!Number.isFinite(o.yaw) || !Number.isFinite(o.pitch)) return null;
  return { yaw: o.yaw, pitch: o.pitch };
}

/**
 * Normalize JSON dari DB → SpatialEntity[]. Entitas corrupt di-skip (fail-soft publik).
 */
export function normalizeSpatialEntities(
  raw: unknown,
  sceneId: string
): SpatialEntity[] {
  if (!Array.isArray(raw)) return [];
  const out: SpatialEntity[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.schemaVersion !== 1) continue;
    if (o.kind !== "SPATIAL_AREA") continue; // Phase 5 surface ditunda
    if (typeof o.id !== "string" || !o.id) continue;

    const geom = o.geometry as Record<string, unknown> | undefined;
    if (!geom || geom.type !== "spherical_polygon" || !Array.isArray(geom.vertices)) continue;

    const points = geom.vertices.map(asPoint).filter(Boolean) as SphericalPoint[];
    const validated = validateSphericalPolygon(points);
    if (!validated.ok) continue;

    const actionRaw = (o.action && typeof o.action === "object" ? o.action : {}) as Record<
      string,
      unknown
    >;
    const actionType =
      actionRaw.type === "unit_detail" ||
      actionRaw.type === "info_detail" ||
      actionRaw.type === "open_scene" ||
      actionRaw.type === "none"
        ? actionRaw.type
        : "none";

    out.push({
      id: o.id.slice(0, 64),
      kind: "SPATIAL_AREA",
      sceneId: typeof o.sceneId === "string" && o.sceneId ? o.sceneId : sceneId,
      unitId: typeof o.unitId === "string" ? o.unitId : o.unitId === null ? null : undefined,
      spaceCode:
        typeof o.spaceCode === "string"
          ? o.spaceCode
          : o.spaceCode === null
            ? null
            : undefined,
      label: typeof o.label === "string" ? o.label.slice(0, 160) : undefined,
      geometry: { type: "spherical_polygon", vertices: validated.vertices },
      style: sanitizeStyle(o.style),
      action: {
        type: actionType,
        title: typeof actionRaw.title === "string" ? actionRaw.title.slice(0, 160) : undefined,
        description: typeof actionRaw.description === "string" ? actionRaw.description.slice(0, 2000) : undefined,
        targetId:
          typeof actionRaw.targetId === "string"
            ? actionRaw.targetId
            : actionRaw.targetId === null
              ? null
              : undefined,
      },
      mediaAssetId: null,
      enabled: o.enabled !== false,
      zIndex:
        typeof o.zIndex === "number" && Number.isFinite(o.zIndex)
          ? Math.max(0, Math.min(100, Math.round(o.zIndex)))
          : 0,
      schemaVersion: 1,
      revision:
        typeof o.revision === "number" && Number.isFinite(o.revision)
          ? Math.max(1, Math.round(o.revision))
          : 1,
    });
  }

  return out;
}

/** Strip untuk persist (tanpa field runtime). */
export function spatialEntitiesToSave(entities: SpatialEntity[]): SpatialEntity[] {
  return entities.map((e) => ({
    id: e.id,
    kind: e.kind,
    sceneId: e.sceneId,
    unitId: e.unitId ?? null,
    spaceCode: e.spaceCode ?? null,
    label: e.label,
    geometry: e.geometry,
    style: e.style,
    action: e.action,
    mediaAssetId: e.kind === "PERSPECTIVE_SURFACE" ? e.mediaAssetId ?? null : null,
    enabled: e.enabled,
    zIndex: e.zIndex ?? 0,
    schemaVersion: 1,
    revision: e.revision,
  }));
}
