import { getAllTrainsForPicker } from "@/lib/trains-data";
import { DEFAULT_TRAIN_SLUG } from "@/lib/train-constants";

export async function getDefaultTrainTourHref() {
  const trains = await getAllTrainsForPicker();
  if (trains.length === 1) return `/train/${trains[0].slug}`;
  if (trains.length > 1) return "#pilih-kereta";
  return `/train/${DEFAULT_TRAIN_SLUG}`;
}

export async function getTrainLandingStats() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const [trainCount, carCount, sceneCount] = await Promise.all([
      prisma.train.count({
        where: {
          isActive: true,
          trainTourScenes: { some: { isActive: true } },
        },
      }),
      prisma.trainTourCar.count({ where: { isActive: true } }),
      prisma.trainTourScene.count({ where: { isActive: true } }),
    ]);
    return { trainCount, carCount, sceneCount };
  } catch {
    return { trainCount: 1, carCount: 6, sceneCount: 0 };
  }
}
