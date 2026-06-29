import { prisma } from "@/lib/prisma";
import { DEFAULT_TOUR_LEVELS, slugifyLabel } from "@/lib/virtual-tour-defaults";

export type TourLevel = {
  id: string;
  stationId: string;
  slug: string;
  label: string;
  color: string;
  hint: string | null;
  order: number;
  isActive: boolean;
  areas: TourArea[];
};

export type TourArea = {
  id: string;
  stationId: string;
  levelId: string;
  slug: string;
  label: string;
  order: number;
  isActive: boolean;
};

type SceneSortable = {
  order: number;
  levelRef?: { order: number } | null;
  areaRef?: { order: number } | null;
};

/** Urutkan scene: level → area → order dalam area */
export function sortScenesByTourOrder<T extends SceneSortable>(scenes: T[]): T[] {
  return [...scenes].sort((a, b) => {
    const levelDiff = (a.levelRef?.order ?? 999) - (b.levelRef?.order ?? 999);
    if (levelDiff !== 0) return levelDiff;
    const areaDiff = (a.areaRef?.order ?? 999) - (b.areaRef?.order ?? 999);
    if (areaDiff !== 0) return areaDiff;
    return a.order - b.order;
  });
}

/** Pastikan stasiun punya level & area default; assign scene lama ke area yang sesuai. */
export async function ensureTourStructure(stationId: string): Promise<void> {
  let levels = await prisma.virtualTourLevel.findMany({
    where: { stationId },
    include: { areas: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  if (levels.length === 0) {
    for (const [idx, def] of DEFAULT_TOUR_LEVELS.entries()) {
      await prisma.virtualTourLevel.create({
        data: {
          stationId,
          slug: def.slug,
          label: def.label,
          color: def.color,
          hint: def.hint,
          order: idx,
          areas: {
            create: {
              stationId,
              slug: `${def.slug}-umum`,
              label: def.defaultAreaLabel,
              order: 0,
            },
          },
        },
      });
    }
    levels = await prisma.virtualTourLevel.findMany({
      where: { stationId },
      include: { areas: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });
  }

  const levelByLegacy = new Map<string, (typeof levels)[0]>();
  for (const def of DEFAULT_TOUR_LEVELS) {
    const found = levels.find((l) => l.slug === def.slug);
    if (found) levelByLegacy.set(def.legacyLevel, found);
  }

  const scenes = await prisma.virtualTourScene.findMany({ where: { stationId } });

  for (const scene of scenes) {
    if (scene.areaId && scene.levelId) continue;

    const legacy = scene.level ?? "CONCOURSE";
    const legacyUpper = legacy.toUpperCase();
    const level =
      levels.find((l) => l.id === scene.levelId) ??
      levels.find((l) => l.slug === legacy.toLowerCase()) ??
      levelByLegacy.get(legacyUpper) ??
      levelByLegacy.get(legacy) ??
      levels[0];
    if (!level) continue;

    let area = level.areas[0];
    if (!area) {
      area = await prisma.virtualTourArea.create({
        data: {
          stationId,
          levelId: level.id,
          slug: `${level.slug}-umum`,
          label: `${level.label} Umum`,
          order: 0,
        },
      });
      level.areas.push(area);
    }

    await prisma.virtualTourScene.update({
      where: { id: scene.id },
      data: {
        levelId: level.id,
        areaId: scene.areaId ?? area.id,
        level: level.slug,
      },
    });
  }
}

export async function getTourStructure(stationId: string) {
  await ensureTourStructure(stationId);

  const [levels, areas] = await Promise.all([
    prisma.virtualTourLevel.findMany({
      where: { stationId },
      orderBy: { order: "asc" },
    }),
    prisma.virtualTourArea.findMany({
      where: { stationId },
      orderBy: { order: "asc" },
    }),
  ]);

  const levelsWithAreas: TourLevel[] = levels.map((level) => ({
    ...level,
    areas: areas.filter((a) => a.levelId === level.id),
  }));

  return { levels: levelsWithAreas, areas };
}

export async function uniqueAreaSlug(stationId: string, base: string): Promise<string> {
  let slug = slugifyLabel(base);
  let n = 1;
  while (await prisma.virtualTourArea.findFirst({ where: { stationId, slug } })) {
    slug = `${slugifyLabel(base)}-${++n}`;
  }
  return slug;
}

export async function uniqueLevelSlug(stationId: string, base: string): Promise<string> {
  let slug = slugifyLabel(base);
  let n = 1;
  while (await prisma.virtualTourLevel.findFirst({ where: { stationId, slug } })) {
    slug = `${slugifyLabel(base)}-${++n}`;
  }
  return slug;
}
