export type HotspotType = "scene" | "space" | "info";

export type HotspotData = {
  pitch: number;
  yaw: number;
  type: HotspotType;
  text: string;
  /** Skala visual marker: 0.5 – 2.0, default 1 */
  scale?: number;
  sceneId?: string;
  spaceCode?: string;
  description?: string;
};

export const HOTSPOT_SCALE_MIN = 0.5;
export const HOTSPOT_SCALE_MAX = 2;
export const HOTSPOT_SCALE_DEFAULT = 1;

export function clampHotspotScale(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return HOTSPOT_SCALE_DEFAULT;
  return Math.round(Math.min(HOTSPOT_SCALE_MAX, Math.max(HOTSPOT_SCALE_MIN, n)) * 100) / 100;
}

export type HotspotItem = HotspotData & {
  _id: string;
};

export type AddMode = "none" | "scene" | "space" | "info" | "blur";

export function hotspotColor(type: HotspotType): string {
  if (type === "scene") return "#10b981";
  if (type === "space") return "#f59e0b";
  return "#3b82f6";
}

export function hotspotLabel(type: HotspotType): string {
  if (type === "scene") return "Scene";
  if (type === "space") return "Unit";
  return "Info";
}
