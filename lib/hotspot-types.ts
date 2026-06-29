export type HotspotType = "scene" | "space" | "info";

export type HotspotData = {
  pitch: number;
  yaw: number;
  type: HotspotType;
  text: string;
  sceneId?: string;
  spaceCode?: string;
  description?: string;
};

export type HotspotItem = HotspotData & {
  _id: string;
};

export type AddMode = "none" | "scene" | "space" | "info";

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
