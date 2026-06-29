import type { Hotspot } from "./tour-types";
import { clampHotspotScale } from "./hotspot-types";

/** Normalisasi hotspot dari JSON DB agar tipe & field konsisten di editor/preview/publik. */
export function normalizeHotspots(raw: unknown): Hotspot[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => {
    const h = item as Record<string, unknown>;
    const pitch = Number(h.pitch ?? 0);
    const yaw = Number(h.yaw ?? 0);
    const text = String(h.text ?? "");
    const sceneId = h.sceneId ? String(h.sceneId) : undefined;
    const spaceCode = h.spaceCode ? String(h.spaceCode) : undefined;
    const description = h.description != null ? String(h.description) : undefined;

    let type = h.type as Hotspot["type"] | undefined;
    if (!type || !["scene", "space", "info"].includes(type)) {
      if (description != null && description !== "") type = "info";
      else if (spaceCode) type = "space";
      else type = "scene";
    }

    return {
      pitch,
      yaw,
      type,
      text,
      scale: clampHotspotScale(h.scale),
      sceneId,
      spaceCode,
      description,
    };
  });
}
