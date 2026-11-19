import { z } from "zod";
import {
  FLOORPLAN_PROTOTYPE_BY_SLUG,
  layersFromCatalog,
  layersToMinimapAssets,
  type FloorPlanLayer,
} from "./station-floorplan";

export type MinimapAsset = { name: string; sourceKey: string; url: string; width: number; height: number };
export { FLOORPLAN_PROTOTYPE_BY_SLUG };

export const minimapPoint = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  yawOffset: z.number().min(-180).max(180),
}).strict();
export type MinimapPoint = z.infer<typeof minimapPoint>;

const positionIndex = z.record(z.string(), minimapPoint);
const configSchema = z.object({
  sourceKey: z.string(),
  positionsBySource: z.record(z.string(), positionIndex),
}).strict();

export type MinimapConfig = z.infer<typeof configSchema>;
export type StationMinimapData = {
  asset: MinimapAsset;
  positions: Record<string, MinimapPoint>;
};

export function minimapAssets(stationSlug: string, dbLayers?: FloorPlanLayer[], levelId?: string): MinimapAsset[] {
  const layers = dbLayers ?? layersFromCatalog(stationSlug);
  return layersToMinimapAssets(layers.filter(layer => !levelId || !layer.levelId || layer.levelId === levelId));
}

export function parseMinimapConfig(value: unknown): MinimapConfig | null {
  const parsed = configSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function resolveStationMinimap(
  stationSlug: string,
  level: { id?: string; slug: string; label: string; minimap: unknown },
  dbLayers?: FloorPlanLayer[],
): StationMinimapData | null {
  const assets = minimapAssets(stationSlug, dbLayers, level.id);
  const bound = level.id ? layersToMinimapAssets(dbLayers?.filter(layer => layer.levelId === level.id) ?? []) : [];
  const config = parseMinimapConfig(level.minimap);
  const label = level.label.trim().toLowerCase();
  const aliases = level.slug === "platform" ? [label, "peron"] : [label, level.slug.toLowerCase()];
  const matches = assets.filter(asset => aliases.includes(asset.name.trim().toLowerCase()));
  const asset = assets.find(item => item.sourceKey === config?.sourceKey)
    ?? (bound.length === 1 ? bound[0] : undefined)
    ?? (matches.length === 1 ? matches[0] : undefined);
  if (!asset) return null;
  return { asset, positions: config?.positionsBySource[asset.sourceKey] ?? {} };
}
