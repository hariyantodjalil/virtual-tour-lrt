import type { PanoramaScene } from "@/lib/tour-types";

export type SpaceHotspotPlacement = {
  sceneId: string;
  yaw: number;
  pitch: number;
};

/** Cari scene + koordinat hotspot unit berdasarkan kode ruang komersial. */
export function findSpaceHotspotPlacement(
  scenes: PanoramaScene[],
  spaceCode: string
): SpaceHotspotPlacement | null {
  const code = spaceCode.trim().toUpperCase();
  if (!code) return null;

  for (const scene of scenes) {
    const hotspot = scene.hotspots.find(
      (h) =>
        h.type === "space" &&
        h.spaceCode?.trim().toUpperCase() === code
    );
    if (hotspot) {
      return { sceneId: scene.id, yaw: hotspot.yaw, pitch: hotspot.pitch };
    }
  }
  return null;
}
