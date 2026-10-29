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

  // Fallback: centroid Spatial Area yang taut ke spaceCode
  for (const scene of scenes) {
    const entity = (scene.spatialEntities ?? []).find(
      (e) =>
        e.enabled &&
        e.action.type === "unit_detail" &&
        e.spaceCode?.trim().toUpperCase() === code &&
        e.geometry.type === "spherical_polygon" &&
        e.geometry.vertices.length >= 3
    );
    if (entity && entity.geometry.type === "spherical_polygon") {
      const verts = entity.geometry.vertices;
      const yaw =
        verts.reduce((s, v) => s + v.yaw, 0) / verts.length;
      const pitch =
        verts.reduce((s, v) => s + v.pitch, 0) / verts.length;
      return { sceneId: scene.id, yaw, pitch };
    }
  }
  return null;
}
