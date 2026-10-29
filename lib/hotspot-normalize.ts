import type { Hotspot } from "./tour-types";
import {
  clampHotspotScale,
  HOTSPOT_DIRECTIONS,
  type HotspotDirection,
  type HotspotType,
} from "./hotspot-types";
import { isFacilityIconId } from "./facility-icons";
import { sceneEntryViewSchema } from "./scene-entry-view";

function normalizeDirection(raw: unknown): HotspotDirection | undefined {
  if (typeof raw !== "string") return undefined;
  return (HOTSPOT_DIRECTIONS as string[]).includes(raw)
    ? (raw as HotspotDirection)
    : undefined;
}

function normalizeType(raw: unknown): HotspotType | undefined {
  if (raw === "scene" || raw === "space" || raw === "info" || raw === "ad") return raw;
  return undefined;
}

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
    const creativeUrl = h.creativeUrl ? String(h.creativeUrl) : undefined;
    const creativeTitle = h.creativeTitle ? String(h.creativeTitle) : undefined;
    const direction = normalizeDirection(h.direction);
    const facilityIcon = isFacilityIconId(h.facilityIcon) ? h.facilityIcon : undefined;

    let type = normalizeType(h.type);
    if (!type) {
      if (description != null && description !== "") type = "info";
      else if (spaceCode && (creativeUrl || creativeTitle)) type = "ad";
      else if (spaceCode) type = "space";
      else type = "scene";
    }

    const targetView = type === "scene" ? sceneEntryViewSchema.safeParse(h.targetView) : null;

    return {
      pitch,
      yaw,
      type,
      text,
      scale: clampHotspotScale(h.scale),
      ...(type === "scene" && direction ? { direction } : {}),
      ...(targetView?.success ? { targetView: targetView.data } : {}),
      sceneId,
      spaceCode,
      description,
      ...(type === "info" && facilityIcon ? { facilityIcon } : {}),
      ...(type === "ad"
        ? {
            ...(creativeUrl ? { creativeUrl } : {}),
            ...(creativeTitle ? { creativeTitle } : {}),
          }
        : {}),
    };
  });
}
