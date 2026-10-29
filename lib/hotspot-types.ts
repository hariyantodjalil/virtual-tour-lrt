import type { FacilityIconId } from "./facility-icons";
import type { SceneInitialView } from "./tour-types";

export type HotspotType = "scene" | "space" | "info" | "ad";

export type HotspotDirection =
  | "right"
  | "left"
  | "up"
  | "down"
  | "up-right"
  | "up-left"
  | "down-right"
  | "down-left";

export const HOTSPOT_DIRECTIONS: HotspotDirection[] = [
  "up-left",
  "up",
  "up-right",
  "left",
  "right",
  "down-left",
  "down",
  "down-right",
];

export const DIRECTION_LABELS: Record<HotspotDirection, string> = {
  right: "Kanan",
  left: "Kiri",
  up: "Depan",
  down: "Belakang",
  "up-right": "Serong kanan depan",
  "up-left": "Serong kiri depan",
  "down-right": "Serong kanan belakang",
  "down-left": "Serong kiri belakang",
};

/** Layout 3×3 compass: null = center kosong */
export const DIRECTION_COMPASS: (HotspotDirection | null)[] = [
  "up-left",
  "up",
  "up-right",
  "left",
  null,
  "right",
  "down-left",
  "down",
  "down-right",
];

export const DIRECTION_ROTATE_DEG: Record<HotspotDirection, number> = {
  right: 0,
  "up-right": -45,
  up: -90,
  "up-left": -135,
  left: 180,
  "down-left": 135,
  down: 90,
  "down-right": 45,
};

export const MEDIA_SPACE_TYPES = ["MEDIA_IKLAN", "AREA_PROMOSI"] as const;

export function isMediaSpaceType(type: string | undefined): boolean {
  return MEDIA_SPACE_TYPES.includes(type as (typeof MEDIA_SPACE_TYPES)[number]);
}

export type HotspotData = {
  pitch: number;
  yaw: number;
  type: HotspotType;
  text: string;
  /** Skala visual marker: 0.5 – 2.0, default 1 */
  scale?: number;
  /** Arah chevron scene hotspot */
  direction?: HotspotDirection;
  sceneId?: string;
  /** Arah pandang saat tiba melalui koneksi ini, dalam koordinat panorama tujuan. */
  targetView?: SceneInitialView;
  spaceCode?: string;
  description?: string;
  /** Ikon fasilitas untuk hotspot info (toilet, mushola, dll.) */
  facilityIcon?: FacilityIconId;
  /** URL aset kreatif untuk hotspot iklan */
  creativeUrl?: string;
  creativeTitle?: string;
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

export type AddMode =
  | "none"
  | "pan"
  | "scene"
  | "space"
  | "info"
  | "ad"
  | "blur"
  | "spatial";

export function hotspotColor(type: HotspotType): string {
  if (type === "scene") return "#E31E2D";
  if (type === "space") return "#f59e0b";
  if (type === "ad") return "#a855f7";
  return "#3b82f6";
}

export function hotspotLabel(type: HotspotType): string {
  if (type === "scene") return "Scene";
  if (type === "space") return "Unit";
  if (type === "ad") return "Iklan";
  return "Info";
}
