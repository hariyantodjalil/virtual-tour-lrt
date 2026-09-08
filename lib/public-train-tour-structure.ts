import type { TourAreaPublic, TourLevelPublic } from "@/lib/tour-types";
import { DEFAULT_TRAIN_CARS } from "@/lib/train-tour-defaults";

type SceneRow = {
  sceneId: string;
  carId: string | null;
  zoneId: string | null;
  car: string;
};

type CarRow = {
  id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  isActive: boolean;
};

type ZoneRow = {
  id: string;
  carId: string;
  slug: string;
  label: string;
  order: number;
  isActive: boolean;
};

function sceneMatchesCar(scene: SceneRow, car: CarRow): boolean {
  if (scene.carId === car.id) return true;
  const slug = scene.car?.toLowerCase() ?? "";
  return slug === car.slug;
}

function scenesInZone(scenes: SceneRow[], zone: ZoneRow, car: CarRow): string[] {
  const inZone = scenes.filter((s) => s.zoneId === zone.id).map((s) => s.sceneId);
  if (inZone.length > 0) return inZone;

  const carDef = DEFAULT_TRAIN_CARS.find((d) => d.slug === car.slug);
  const isDefaultZone =
    zone.order === 0 || zone.slug.endsWith("-utama") || zone.label === carDef?.defaultZoneLabel;

  if (isDefaultZone) {
    return scenes
      .filter((s) => sceneMatchesCar(s, car) && !s.zoneId)
      .map((s) => s.sceneId);
  }
  return [];
}

export function buildPublicTrainTourLevels(
  cars: CarRow[],
  zones: ZoneRow[],
  scenes: SceneRow[]
): TourLevelPublic[] {
  return cars
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order)
    .map((car) => {
      const carZones = zones
        .filter((z) => z.carId === car.id && z.isActive)
        .sort((a, b) => a.order - b.order);

      const publicZones: TourAreaPublic[] = carZones.map((zone) => ({
        id: zone.id,
        slug: zone.slug,
        label: zone.label,
        order: zone.order,
        sceneIds: scenesInZone(scenes, zone, car),
      }));

      const assignedToZone = new Set(publicZones.flatMap((z) => z.sceneIds));
      const unassignedSceneIds = scenes
        .filter((s) => sceneMatchesCar(s, car) && !assignedToZone.has(s.sceneId))
        .map((s) => s.sceneId);

      return {
        id: car.id,
        slug: car.slug,
        label: car.label,
        color: car.color,
        order: car.order,
        areas: publicZones,
        sceneIds: unassignedSceneIds,
      };
    });
}

export {
  firstSceneIdInLevel,
  findScenePlacement,
  scenesForNav,
  defaultAreaForLevel,
} from "@/lib/public-tour-structure";
