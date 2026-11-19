import type { StationInfo } from "./tour-types";
import { findScenePlacement } from "./public-tour-structure";

export type TourLocationBreadcrumb = {
  stationName: string;
  locationParts: string[];
  sceneLabel: string | null;
};

export function getTourLocationBreadcrumb(station: Pick<StationInfo, "name" | "levels" | "scenes">, sceneId: string): TourLocationBreadcrumb {
  const scene = station.scenes.find(item => item.id === sceneId);
  const placement = findScenePlacement(station.levels, sceneId);
  const linkedLevel = station.levels.find(level => level.id === scene?.levelId)
    ?? station.levels.find(level => level.areas.some(area => area.id === scene?.areaId))
    ?? placement?.level;
  const level = linkedLevel?.label.trim() || "";
  const area = linkedLevel?.areas.find(item => item.id === scene?.areaId)?.label.trim() || "";
  const locationParts = area && (!level || area.toLocaleLowerCase().includes(level.toLocaleLowerCase()))
    ? [area] : [level, area].filter(Boolean);
  const title = scene?.title.trim() || "";
  let sceneLabel = title;
  // Some entrances repeat the area at the start of the scene title.
  if (area && sceneLabel.toLocaleLowerCase().startsWith(area.toLocaleLowerCase())) {
    const detail = /^\s*[-–—:·]\s*(\S.*)$/.exec(sceneLabel.slice(area.length))?.[1];
    if (detail) sceneLabel = detail;
  }
  // Checkpoint titles often repeat the area at the end.
  for (const suffix of [locationParts.join(" "), area, level].filter(Boolean)) {
    if (sceneLabel.toLocaleLowerCase().endsWith(` ${suffix.toLocaleLowerCase()}`)) {
      sceneLabel = sceneLabel.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }
  return { stationName: station.name, locationParts, sceneLabel: sceneLabel || null };
}
