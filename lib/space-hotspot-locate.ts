import { add, dirToSpherical, sphericalToDir } from "./spatial/geometry/spherical";
import type { PrimaryUnitHotspot } from "./primary-unit-hotspot";
import type { Hotspot, PanoramaScene } from "./tour-types";

export type SpaceHotspotPlacement = {
  sceneId: string;
  yaw: number;
  pitch: number;
  spatialId?: string;
};

export type SpaceHotspotTarget = { sceneId: string } & (
  { spatialId: string } | { yaw: number; pitch: number }
);

type SceneHotspots = Pick<PanoramaScene, "id" | "hotspots" | "spatialEntities">;

export function findUnitPinIndex(hotspots: Hotspot[], spaceCode: string, pinId?: string): number {
  const code = spaceCode.trim().toUpperCase();
  return hotspots.findIndex(hotspot => hotspot.type === "space" &&
    hotspot.spaceCode?.trim().toUpperCase() === code &&
    (pinId === undefined || hotspot.pinId === pinId));
}

function findPin(scene: SceneHotspots, code: string, pinId?: string): SpaceHotspotPlacement | null {
  const pin = scene.hotspots[findUnitPinIndex(scene.hotspots, code, pinId)];
  return pin && Number.isFinite(pin.yaw) && Number.isFinite(pin.pitch)
    ? { sceneId: scene.id, yaw: pin.yaw, pitch: pin.pitch }
    : null;
}

function findSpatial(scene: SceneHotspots, code: string, spatialId?: string): SpaceHotspotPlacement | null {
  const area = scene.spatialEntities?.find(entity =>
    entity.enabled && entity.action.type === "unit_detail" &&
    entity.spaceCode?.trim().toUpperCase() === code &&
    (spatialId === undefined || entity.id === spatialId) &&
    entity.geometry.type === "spherical_polygon" && entity.geometry.vertices.length >= 3
  );
  if (area?.geometry.type !== "spherical_polygon") return null;
  const direction = area.geometry.vertices.map(sphericalToDir).reduce(add, { x: 0, y: 0, z: 0 });
  return { sceneId: scene.id, ...dirToSpherical(direction), spatialId: area.id };
}

export function resolvePrimaryUnitHotspot(
  scene: SceneHotspots,
  spaceCode: string,
  target: PrimaryUnitHotspot,
): SpaceHotspotPlacement | null {
  if (scene.id !== target.sceneId) return null;
  const code = spaceCode.trim().toUpperCase();
  return target.kind === "pin"
    ? findPin(scene, code, target.hotspotId)
    : findSpatial(scene, code, target.hotspotId);
}

export function findSpaceHotspotPlacement(
  scenes: PanoramaScene[],
  spaceCode: string,
  primary?: PrimaryUnitHotspot | null,
): SpaceHotspotPlacement | null {
  const code = spaceCode.trim().toUpperCase();
  if (!code) return null;

  if (primary) {
    const scene = scenes.find(item => item.id === primary.sceneId);
    const placement = scene && resolvePrimaryUnitHotspot(scene, code, primary);
    if (placement) return placement;
  }

  for (const scene of scenes) {
    const placement = findPin(scene, code);
    if (placement) return placement;
  }
  for (const scene of scenes) {
    const placement = findSpatial(scene, code);
    if (placement) return placement;
  }
  return null;
}
