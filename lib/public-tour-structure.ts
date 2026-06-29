import type { TourAreaPublic, TourLevelPublic } from "@/lib/tour-types";
import { DEFAULT_TOUR_LEVELS } from "@/lib/virtual-tour-defaults";

type SceneRow = {
  sceneId: string;
  levelId: string | null;
  areaId: string | null;
  level: string;
};

type LevelRow = {
  id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  isActive: boolean;
};

type AreaRow = {
  id: string;
  levelId: string;
  slug: string;
  label: string;
  order: number;
  isActive: boolean;
};

function sceneMatchesLevel(scene: SceneRow, level: LevelRow): boolean {
  if (scene.levelId === level.id) return true;
  const slug = scene.level?.toLowerCase() ?? "";
  if (slug === level.slug) return true;
  const legacy = DEFAULT_TOUR_LEVELS.find((d) => d.slug === level.slug);
  if (legacy && scene.level?.toUpperCase() === legacy.legacyLevel) return true;
  return false;
}

function scenesInArea(scenes: SceneRow[], area: AreaRow, level: LevelRow): string[] {
  const inArea = scenes.filter((s) => s.areaId === area.id).map((s) => s.sceneId);
  if (inArea.length > 0) return inArea;

  // Scene punya level tapi belum areaId — masuk ke area default (pertama) level itu
  const levelAreas = DEFAULT_TOUR_LEVELS.find((d) => d.slug === level.slug);
  const isDefaultArea =
    area.order === 0 || area.slug.endsWith("-umum") || area.label === levelAreas?.defaultAreaLabel;

  if (isDefaultArea) {
    return scenes
      .filter((s) => sceneMatchesLevel(s, level) && !s.areaId)
      .map((s) => s.sceneId);
  }
  return [];
}

/**
 * Bangun hierarki level → area untuk tour publik.
 * Semua level & area aktif dari CMS ditampilkan (meski belum ada scene).
 */
export function buildPublicTourLevels(
  levels: LevelRow[],
  areas: AreaRow[],
  scenes: SceneRow[]
): TourLevelPublic[] {
  return levels
    .filter((l) => l.isActive)
    .sort((a, b) => a.order - b.order)
    .map((level) => {
      const levelAreas = areas
        .filter((a) => a.levelId === level.id && a.isActive)
        .sort((a, b) => a.order - b.order);

      const publicAreas: TourAreaPublic[] = levelAreas.map((area) => ({
        id: area.id,
        slug: area.slug,
        label: area.label,
        order: area.order,
        sceneIds: scenesInArea(scenes, area, level),
      }));

      const assignedToArea = new Set(publicAreas.flatMap((a) => a.sceneIds));
      const unassignedSceneIds = scenes
        .filter((s) => sceneMatchesLevel(s, level) && !assignedToArea.has(s.sceneId))
        .map((s) => s.sceneId);

      return {
        id: level.id,
        slug: level.slug,
        label: level.label,
        color: level.color,
        order: level.order,
        areas: publicAreas,
        sceneIds: unassignedSceneIds,
      };
    });
}

export function firstSceneIdInLevel(level: TourLevelPublic): string | undefined {
  for (const area of level.areas) {
    if (area.sceneIds.length > 0) return area.sceneIds[0];
  }
  return level.sceneIds[0];
}

export function findScenePlacement(
  levels: TourLevelPublic[],
  sceneId: string
): { level: TourLevelPublic; area?: TourAreaPublic } | null {
  for (const level of levels) {
    for (const area of level.areas) {
      if (area.sceneIds.includes(sceneId)) return { level, area };
    }
    if (level.sceneIds.includes(sceneId)) return { level };
  }
  return null;
}

export function scenesForNav(
  levels: TourLevelPublic[],
  allSceneIds: string[],
  activeLevelId: string,
  activeAreaId?: string | null
): string[] {
  const level = levels.find((l) => l.id === activeLevelId);
  if (!level) return allSceneIds;

  if (activeAreaId) {
    const area = level.areas.find((a) => a.id === activeAreaId);
    if (area) return area.sceneIds;
  }

  if (level.areas.length >= 1) {
    const area = level.areas.find((a) => a.id === activeAreaId) ?? level.areas[0];
    if (area) return area.sceneIds;
  }

  return level.sceneIds.length > 0 ? level.sceneIds : allSceneIds;
}

/** Area default untuk level (pertama / Concourse Umum dll.) */
export function defaultAreaForLevel(level: TourLevelPublic): TourAreaPublic | undefined {
  return level.areas[0];
}
