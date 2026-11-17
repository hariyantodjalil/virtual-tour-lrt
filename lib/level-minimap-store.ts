import { prisma } from "@/lib/prisma";
import { parseLevelMinimap, type LevelMinimap } from "@/lib/minimap";

/**
 * Baca/tulis kolom virtual_tour_levels.minimap lewat SQL langsung. Dengan begitu fitur minimap tetap
 * berjalan walau proses server masih memakai Prisma Client yang dibuat sebelum kolom ini ditambahkan
 * (mis. server dev yang belum di-restart setelah migrasi).
 */
export async function getLevelMinimaps(stationId: string): Promise<Map<string, LevelMinimap>> {
  const rows = await prisma.$queryRaw<{ id: string; minimap: unknown }[]>`
    SELECT "id", "minimap" FROM "virtual_tour_levels"
    WHERE "stationId" = ${stationId} AND "minimap" IS NOT NULL
  `;
  const result = new Map<string, LevelMinimap>();
  for (const row of rows) {
    const minimap = parseLevelMinimap(row.minimap);
    if (minimap) result.set(row.id, minimap);
  }
  return result;
}

export async function setLevelMinimap(
  stationId: string,
  levelId: string,
  minimap: LevelMinimap | null
): Promise<boolean> {
  const json = minimap ? JSON.stringify(minimap) : null;
  const count = await prisma.$executeRaw`
    UPDATE "virtual_tour_levels"
    SET "minimap" = ${json}::jsonb, "updatedAt" = NOW()
    WHERE "id" = ${levelId} AND "stationId" = ${stationId}
  `;
  return count > 0;
}

/** Tempelkan minimap ke daftar level (dipakai editor CMS dan halaman tur publik). */
export async function withLevelMinimaps<T extends { id: string }>(
  stationId: string,
  levels: T[]
): Promise<(T & { minimap: LevelMinimap | null })[]> {
  const minimaps = await getLevelMinimaps(stationId);
  return levels.map((level) => ({ ...level, minimap: minimaps.get(level.id) ?? null }));
}
