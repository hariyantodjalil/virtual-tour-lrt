import { prisma } from "@/lib/prisma";
import { DEFAULT_TRAIN_CARS, slugifyLabel } from "@/lib/train-tour-defaults";

export type TrainTourCar = {
  id: string;
  trainId: string;
  slug: string;
  label: string;
  color: string;
  hint: string | null;
  order: number;
  isActive: boolean;
  zones: TrainTourZone[];
};

export type TrainTourZone = {
  id: string;
  trainId: string;
  carId: string;
  slug: string;
  label: string;
  order: number;
  isActive: boolean;
};

type SceneSortable = {
  order: number;
  carRef?: { order: number } | null;
  zoneRef?: { order: number } | null;
};

export function sortTrainScenesByTourOrder<T extends SceneSortable>(scenes: T[]): T[] {
  return [...scenes].sort((a, b) => {
    const carDiff = (a.carRef?.order ?? 999) - (b.carRef?.order ?? 999);
    if (carDiff !== 0) return carDiff;
    const zoneDiff = (a.zoneRef?.order ?? 999) - (b.zoneRef?.order ?? 999);
    if (zoneDiff !== 0) return zoneDiff;
    return a.order - b.order;
  });
}

export async function ensureTrainTourStructure(trainId: string): Promise<void> {
  let cars = await prisma.trainTourCar.findMany({
    where: { trainId },
    include: { zones: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  // Pastikan semua gerbong default ada (mis. upgrade 3 → 6)
  for (const [idx, def] of DEFAULT_TRAIN_CARS.entries()) {
    if (cars.some((c) => c.slug === def.slug)) continue;
    await prisma.trainTourCar.create({
      data: {
        trainId,
        slug: def.slug,
        label: def.label,
        color: def.color,
        hint: def.hint,
        order: idx,
        zones: {
          create: {
            trainId,
            slug: `${def.slug}-utama`,
            label: def.defaultZoneLabel,
            order: 0,
          },
        },
      },
    });
  }

  cars = await prisma.trainTourCar.findMany({
    where: { trainId },
    include: { zones: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  const scenes = await prisma.trainTourScene.findMany({ where: { trainId } });

  for (const scene of scenes) {
    if (scene.zoneId && scene.carId) continue;

    const car =
      cars.find((c) => c.id === scene.carId) ??
      cars.find((c) => c.slug === scene.car?.toLowerCase()) ??
      cars[0];
    if (!car) continue;

    let zone = car.zones[0];
    if (!zone) {
      zone = await prisma.trainTourZone.create({
        data: {
          trainId,
          carId: car.id,
          slug: `${car.slug}-utama`,
          label: `${car.label} Utama`,
          order: 0,
        },
      });
      car.zones.push(zone);
    }

    await prisma.trainTourScene.update({
      where: { id: scene.id },
      data: {
        carId: car.id,
        zoneId: scene.zoneId ?? zone.id,
        car: car.slug,
      },
    });
  }
}

export async function getTrainTourStructure(trainId: string) {
  await ensureTrainTourStructure(trainId);

  const [cars, zones] = await Promise.all([
    prisma.trainTourCar.findMany({
      where: { trainId },
      orderBy: { order: "asc" },
    }),
    prisma.trainTourZone.findMany({
      where: { trainId },
      orderBy: { order: "asc" },
    }),
  ]);

  const carsWithZones: TrainTourCar[] = cars.map((car) => ({
    ...car,
    zones: zones.filter((z) => z.carId === car.id),
  }));

  return { cars: carsWithZones, zones };
}

export async function uniqueTrainZoneSlug(trainId: string, base: string): Promise<string> {
  let slug = slugifyLabel(base);
  let n = 1;
  while (await prisma.trainTourZone.findFirst({ where: { trainId, slug } })) {
    slug = `${slugifyLabel(base)}-${++n}`;
  }
  return slug;
}

export async function uniqueTrainCarSlug(trainId: string, base: string): Promise<string> {
  let slug = slugifyLabel(base);
  let n = 1;
  while (await prisma.trainTourCar.findFirst({ where: { trainId, slug } })) {
    slug = `${slugifyLabel(base)}-${++n}`;
  }
  return slug;
}

/** Map gerbong/zona ke bentuk level/area agar komponen tour publik bisa dipakai ulang */
export function mapTrainCarsToTourLevels(cars: TrainTourCar[]) {
  return cars.map((car) => ({
    id: car.id,
    slug: car.slug,
    label: car.label,
    color: car.color,
    order: car.order,
    areas: car.zones.map((zone) => ({
      id: zone.id,
      slug: zone.slug,
      label: zone.label,
      order: zone.order,
      sceneIds: [] as string[],
    })),
    sceneIds: [] as string[],
  }));
}
