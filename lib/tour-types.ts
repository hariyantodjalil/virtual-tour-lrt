import type { PrivacyBlur } from "./privacy-blur-types";
import type { FacilityIconId } from "./facility-icons";
import type { PannellumMultiRes } from "./panorama-multires";

export type Hotspot = {
  pitch: number;
  yaw: number;
  type: "scene" | "space" | "info" | "ad";
  text: string;
  scale?: number;
  direction?:
    | "right"
    | "left"
    | "up"
    | "down"
    | "up-right"
    | "up-left"
    | "down-right"
    | "down-left";
  sceneId?: string;
  spaceCode?: string;
  description?: string;
  /** Ikon fasilitas (toilet, mushola, dll.) — hanya untuk type info */
  facilityIcon?: FacilityIconId;
  creativeUrl?: string;
  creativeTitle?: string;
};

export type SceneInitialView = {
  yaw: number;
  pitch: number;
  hfov?: number;
};

export type PanoramaScene = {
  id: string;
  title: string;
  panoramaUrl: string;
  multiRes?: PannellumMultiRes;
  privacyBlurs?: PrivacyBlur[];
  initialView?: SceneInitialView;
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
