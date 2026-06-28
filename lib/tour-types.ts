export type Hotspot = {
  pitch: number;
  yaw: number;
  type: "scene" | "space" | "info";
  text: string;
  sceneId?: string;
  spaceCode?: string;
  description?: string;
};

export type PanoramaScene = {
  id: string;
  title: string;
  panoramaUrl: string;
  hotspots: Hotspot[];
  thumbnailUrl?: string;
};

export type StationInfo = {
  slug: string;
  name: string;
  code?: string;
  line: string;
  order: number;
  dailyPassengers: number;
  address: string;
  scenes: PanoramaScene[];
};
