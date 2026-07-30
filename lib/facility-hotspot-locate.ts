import type { FacilityIconId } from "@/lib/facility-icons";
import type { PanoramaScene } from "@/lib/tour-types";

export type FacilityHotspotPlacement = {
  sceneId: string;
  yaw: number;
  pitch: number;
  title: string;
  description: string;
};

/** Cari hotspot info fasilitas. Utamakan scene aktif, lalu scene lain. */
export function findFacilityHotspotPlacement(
  scenes: PanoramaScene[],
  facilityIcon: FacilityIconId,
  preferSceneId?: string
): FacilityHotspotPlacement | null {
  const match = (scene: PanoramaScene) =>
    scene.hotspots.find(
      (h) => h.type === "info" && h.facilityIcon === facilityIcon
    );

  if (preferSceneId) {
    const preferred = scenes.find((s) => s.id === preferSceneId);
    if (preferred) {
      const hotspot = match(preferred);
      if (hotspot) {
        return {
          sceneId: preferred.id,
          yaw: hotspot.yaw,
          pitch: hotspot.pitch,
          title: hotspot.text || facilityIcon,
          description: hotspot.description ?? "",
        };
      }
    }
  }

  for (const scene of scenes) {
    if (scene.id === preferSceneId) continue;
    const hotspot = match(scene);
    if (hotspot) {
      return {
        sceneId: scene.id,
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
        title: hotspot.text || facilityIcon,
        description: hotspot.description ?? "",
      };
    }
  }

  return null;
}
