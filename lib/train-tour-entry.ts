import { getAllTrainsForPicker } from "@/lib/trains-data";
import { DEFAULT_TRAIN_SLUG } from "@/lib/train-constants";

export async function getDefaultTrainTourHref() {
  const trains = await getAllTrainsForPicker();
  const train = trains.find(({ slug }) => slug === DEFAULT_TRAIN_SLUG) ?? trains[0];
  return `/train/${train?.slug ?? DEFAULT_TRAIN_SLUG}`;
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
