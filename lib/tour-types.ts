export type Hotspot = {
  pitch: number;
  yaw: number;
  type: "scene" | "space";
  text: string;
  sceneId?: string;
  spaceCode?: string;
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
  line: string;
  order: number;
  dailyPassengers: number;
  address: string;
  scenes: PanoramaScene[];
};
