import { prisma } from "@/lib/prisma";
import { normalizeTileBasePath, tileAliasId } from "./panorama-tile-path";

const FRESH_MS = 10 * 60_000;
const MISS_REBUILD_MIN_MS = 15_000;

type AliasIndex = { map: Map<string, string>; builtAt: number };

let index: AliasIndex | undefined;
let building: Promise<AliasIndex> | undefined;
/** Pyramid yang baru diunggah di proses ini, sebelum canvasData-nya tersimpan ke DB. */
const registered = new Map<string, string>();

function collectBasePaths(node: unknown, out: Set<string>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectBasePaths(item, out);
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "basePath" && typeof value === "string" && value.length > 0) out.add(normalizeTileBasePath(value));
    else collectBasePaths(value, out);
  }
}

async function buildIndex(): Promise<AliasIndex> {
  const [stationScenes, trainScenes] = await Promise.all([
    prisma.virtualTourScene.findMany({ select: { canvasData: true } }),
    prisma.trainTourScene.findMany({ select: { canvasData: true } }),
  ]);
  const basePaths = new Set<string>();
  for (const row of [...stationScenes, ...trainScenes]) collectBasePaths(row.canvasData, basePaths);
  const map = new Map<string, string>();
  for (const basePath of basePaths) map.set(tileAliasId(basePath), basePath);
  return { map, builtAt: Date.now() };
}

function rebuild(): Promise<AliasIndex> {
  building ??= buildIndex()
    .then((next) => (index = next))
    .finally(() => {
      building = undefined;
    });
  return building;
}

export function registerTileAlias(basePath: string) {
  const normalized = normalizeTileBasePath(basePath);
  registered.set(tileAliasId(normalized), normalized);
}

/** Resolve alias id → basePath tile di S3, dari canvasData scene stasiun & kereta. */
export async function resolveTileAlias(id: string): Promise<string | undefined> {
  const fresh = registered.get(id);
  if (fresh) return fresh;
  const now = Date.now();
  if (!index) await rebuild();
  else if (now - index.builtAt > FRESH_MS) void rebuild().catch(() => undefined);
  const hit = index?.map.get(id);
  if (hit) return hit;
  if (index && now - index.builtAt > MISS_REBUILD_MIN_MS) await rebuild();
  return index?.map.get(id);
}
