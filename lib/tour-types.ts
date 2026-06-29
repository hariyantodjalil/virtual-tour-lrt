import type { PrivacyBlur } from "./privacy-blur-types";

export type Hotspot = {
  pitch: number;
  yaw: number;
  type: "scene" | "space" | "info";
  text: string;
  scale?: number;
  sceneId?: string;
  spaceCode?: string;
  description?: string;
};

export type PanoramaScene = {
  id: string;
  title: string;
  panoramaUrl: string;
  hotspots: Hotspot[];
  privacyBlurs?: PrivacyBlur[];
  thumbnailUrl?: string;
  levelId?: string | null;
  areaId?: string | null;
  levelSlug?: string;
};

export type TourAreaPublic = {
  id: string;
  slug: string;
  label: string;
  order: number;
  sceneIds: string[];
};

export type TourLevelPublic = {
  id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  areas: TourAreaPublic[];
  /** Scene tanpa area (fallback) — urutan sceneId */
  sceneIds: string[];
};

export type StationInfo = {
  slug: string;
  name: string;
  code?: string;
  line: string;
  order: number;
  dailyPassengers: number;
  address: string;
  commercialContactPhone?: string;
  levels: TourLevelPublic[];
  scenes: PanoramaScene[];
};
