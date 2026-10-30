import type { StationInfo } from "./tour-types";
import { findScenePlacement } from "./public-tour-structure";

export type TourLocationBreadcrumb = {
  stationName: string;
  locationLabel: string | null;
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
  const locationLabel = area && (!level || area.toLocaleLowerCase().includes(level.toLocaleLowerCase()))
    ? area : [level, area].filter(Boolean).join(" ");
  const title = scene?.title.trim() || "";
  let sceneLabel = title;
  // The CMS often includes the area again at the end of a scene title.
  for (const suffix of [locationLabel, area, level].filter(Boolean)) {
    if (sceneLabel.toLocaleLowerCase().endsWith(` ${suffix.toLocaleLowerCase()}`)) {
      sceneLabel = sceneLabel.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }
  return { stationName: station.name, locationLabel: locationLabel || null, sceneLabel: sceneLabel || null };
}
