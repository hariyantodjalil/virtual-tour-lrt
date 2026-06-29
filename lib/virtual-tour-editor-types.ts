/**
 * Tipe data editor virtual tour — diselaraskan dengan pola floorplan editor portal-lrt.
 * Mapping portal-lrt → virtual-tour-lrt:
 *   floorPlans / svgFiles  → virtual_tour_scenes (panoramaUrl ≈ svgPath)
 *   placedAssets           → virtual_tour_scenes.hotspots (JSONB per scene)
 *   youAreHerePosition     → virtual_tour_scenes.canvasData.initialView
 *   station_floorplans.data → station_virtual_tours.data (konfigurasi agregat)
 */

import type { PrivacyBlur } from "./privacy-blur-types";

/** Hotspot pada panorama — paralel PlacedAsset di floorplan editor */
export type VirtualTourHotspot = {
  pitch: number;
  yaw: number;
  type: "scene" | "space";
  text: string;
  sceneId?: string;
  spaceCode?: string;
};

/** Metadata canvas per scene */
export type SceneCanvasData = {
  initialView?: {
    yaw: number;
    pitch: number;
    hfov?: number;
  };
  /** Area blur privasi (wajah, dll.) — pitch/yaw + ukuran */
  privacyBlurs?: PrivacyBlur[];
};

/** Konfigurasi agregat virtual tour per stasiun — disimpan di station_virtual_tours.data */
export type StationVirtualTourData = {
  /** Scene yang dibuka pertama kali di publik */
  defaultSceneId?: string;
  /** Override initial view per sceneId */
  initialViews?: Record<string, SceneCanvasData["initialView"]>;
  editorSettings?: {
    autoRotate?: number;
    defaultHfov?: number;
  };
};

/** Scene dalam editor — paralel FloorPlan di portal-lrt */
export type VirtualTourSceneMeta = {
  id: string;
  title: string;
  panoramaUrl: string;
  thumbnailUrl?: string;
  order: number;
  isActive?: boolean;
};
