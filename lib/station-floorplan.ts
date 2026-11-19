import { z } from "zod";
import portalAssets from "./portal-floorplan-assets.json";

/** Prototype denah tipikal per Ganang: A=Harjamukti, B=Dukuh Atas, C=Cawang. */
export const FLOORPLAN_PROTOTYPE_BY_SLUG: Record<string, string> = {
  harjamukti: "harjamukti",
  tmii: "harjamukti",
  "kampung-rambutan": "harjamukti",
  ciracas: "harjamukti",
  "jatibening-baru": "harjamukti",
  "cikunir-1": "harjamukti",
  "cikunir-2": "harjamukti",
  "bekasi-barat": "harjamukti",
  jatimulya: "harjamukti",
  halim: "harjamukti",
  "dukuh-atas": "dukuh-atas",
  setiabudi: "dukuh-atas",
  "rasuna-said": "dukuh-atas",
  kuningan: "dukuh-atas",
  "pancoran-bank-bjb": "dukuh-atas",
  cikoko: "dukuh-atas",
  ciliwung: "dukuh-atas",
  cawang: "cawang",
};

type CatalogAsset = { name: string; sourceKey: string; url: string; width: number; height: number };

const placedBase = z.object({
  id: z.string().trim().min(1).max(128),
  floorPlanId: z.string().trim().min(1).max(128),
  x: z.number().finite(),
  y: z.number().finite(),
  scale: z.number().positive().max(8).default(1),
  rotation: z.number().min(-360).max(360).default(0),
  label: z.string().trim().max(160).optional(),
});

export const placedAssetSchema = z.discriminatedUnion("kind", [
  placedBase.extend({
    kind: z.literal("space"),
    spaceId: z.string().trim().min(1).max(128),
    slotId: z.string().trim().min(1).max(128).optional(),
  }),
  placedBase.extend({
    kind: z.literal("tenant"),
    spaceId: z.string().trim().min(1).max(128),
  }),
  placedBase.extend({
    kind: z.literal("vending"),
  }),
  placedBase.extend({
    kind: z.literal("slot_marker"),
    slotId: z.string().trim().min(1).max(128),
  }),
  placedBase.extend({
    kind: z.literal("scene"),
    sceneId: z.string().trim().min(1).max(160),
    yawOffset: z.number().min(-180).max(180).optional(),
  }),
]);

export const floorPlanLayerSchema = z.object({
  id: z.string().trim().min(1).max(128),
  levelId: z.string().trim().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(80),
  sourceKey: z.string().trim().min(1).max(240),
  url: z.string().trim().min(1).max(260),
  viewBox: z.string().trim().min(1).max(64),
  width: z.number().positive().max(20000),
  height: z.number().positive().max(20000),
  isActive: z.boolean().default(true),
}).strict();

export const stationFloorplanDataSchema = z.object({
  floorPlans: z.array(floorPlanLayerSchema).max(24).default([]),
  placedAssets: z.array(placedAssetSchema).max(500).default([]),
  youAreHerePosition: z.record(z.string(), z.json()).default({}),
  youAreHereScale: z.record(z.string(), z.number().positive().max(8)).default({}),
}).strict();

export type FloorPlanLayer = z.infer<typeof floorPlanLayerSchema>;
export type PlacedAsset = z.infer<typeof placedAssetSchema>;
export type StationFloorplanData = z.infer<typeof stationFloorplanDataSchema>;

export function emptyFloorplanData(): StationFloorplanData {
  return {
    floorPlans: [],
    placedAssets: [],
    youAreHerePosition: {},
    youAreHereScale: {},
  };
}

export function parseStationFloorplanData(value: unknown): StationFloorplanData {
  const parsed = stationFloorplanDataSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyFloorplanData();
}

export function layerViewBox(width: number, height: number): string {
  return `0 0 ${Math.round(width)} ${Math.round(height)}`;
}

export function slugifyFloorName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "floor";
}

export function layersFromCatalog(stationSlug: string): FloorPlanLayer[] {
  const catalog = portalAssets as Record<string, CatalogAsset[]>;
  const own = catalog[stationSlug] ?? [];
  const assets = own.length > 0
    ? own
    : catalog[FLOORPLAN_PROTOTYPE_BY_SLUG[stationSlug] ?? ""] ?? [];
  return assets.map((asset, index) => ({
    id: `floor-${stationSlug}-${slugifyFloorName(asset.name)}-${index + 1}`,
    name: asset.name,
    sourceKey: asset.sourceKey,
    url: asset.url.startsWith("/") ? asset.url : `/${asset.sourceKey}`,
    viewBox: layerViewBox(asset.width, asset.height),
    width: asset.width,
    height: asset.height,
    isActive: true,
  }));
}

export function layersToMinimapAssets(layers: FloorPlanLayer[]): CatalogAsset[] {
  return layers
    .filter((layer) => layer.isActive !== false)
    .map((layer) => ({
      name: layer.name,
      sourceKey: layer.sourceKey,
      url: layer.url.startsWith("/") ? layer.url : `/${layer.sourceKey}`,
      width: layer.width,
      height: layer.height,
    }));
}

/** Validasi referensi placedAssets terhadap katalog space/slot/scene yang diketahui. */
export function validatePlacedAssetRefs(
  data: StationFloorplanData,
  refs: {
    spaceIds: Set<string>;
    slotIds: Set<string>;
    slotSpaceIds?: ReadonlyMap<string, string | null>;
    sceneIds: Set<string>;
  },
): string | null {
  const layers = new Map(data.floorPlans.map(layer => [layer.id, layer]));
  if (layers.size !== data.floorPlans.length) return "ID layer denah harus unik.";
  const assetIds = new Set<string>();
  for (const asset of data.placedAssets) {
    const layer = layers.get(asset.floorPlanId);
    if (!layer) return "Lantai pin tidak ditemukan.";
    if (assetIds.has(asset.id)) return "ID pin harus unik.";
    assetIds.add(asset.id);
    if (asset.x < 0 || asset.x > layer.width || asset.y < 0 || asset.y > layer.height) return "Pin berada di luar denah.";
    if ((asset.kind === "space" || asset.kind === "tenant") && !refs.spaceIds.has(asset.spaceId)) {
      return "Unit komersial tidak valid untuk stasiun ini.";
    }
    if (asset.kind === "slot_marker" && !refs.slotIds.has(asset.slotId)) {
      return "Slot kodifikasi tidak valid untuk stasiun ini.";
    }
    if (asset.kind === "space" && asset.slotId && !refs.slotIds.has(asset.slotId)) {
      return "Slot kodifikasi tidak valid untuk stasiun ini.";
    }
    if (asset.kind === "space" && asset.slotId) {
      const assigned = refs.slotSpaceIds?.get(asset.slotId);
      if (assigned && assigned !== asset.spaceId) return "Slot kodifikasi sudah terkait dengan unit lain.";
    }
    if (asset.kind === "scene" && !refs.sceneIds.has(asset.sceneId)) {
      return "Scene tidak valid untuk stasiun ini.";
    }
  }
  return null;
}

export function newPlacedAssetId(kind: PlacedAsset["kind"]): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
