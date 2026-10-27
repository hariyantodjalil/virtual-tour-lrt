import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { PanoramaScene, TourLevelPublic } from "@/lib/tour-types";
import { normalizeHotspots } from "@/lib/hotspot-normalize";
import { extractPrivacyBlursFromCanvasData } from "@/lib/privacy-blur-normalize";
import { extractInitialViewFromCanvasData } from "@/lib/scene-initial-view";
import { extractMultiResFromCanvasData } from "@/lib/panorama-multires";
import { sortTrainScenesByTourOrder, ensureTrainTourStructure } from "@/lib/train-tour-structure";
import { buildPublicTrainTourLevels } from "@/lib/public-train-tour-structure";

export type TrainInfo = {
  slug: string;
  name: string;
  description?: string;
  formation?: string;
  imageUrl?: string;
  levels: TourLevelPublic[];
  scenes: PanoramaScene[];
};

type TrainRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  formation: string | null;
  imageUrl: string | null;
};

async function mapTrainToInfo(train: TrainRow): Promise<TrainInfo> {
  const [cars, zones, freshScenes] = await Promise.all([
    prisma.trainTourCar.findMany({
      where: { trainId: train.id, isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.trainTourZone.findMany({
      where: { trainId: train.id, isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.trainTourScene.findMany({
      where: { trainId: train.id, isActive: true },
      include: {
        carRef: { select: { order: true } },
        zoneRef: { select: { order: true } },
      },
      orderBy: { order: "asc" },
    }),
  ]);

  const sortedScenes = sortTrainScenesByTourOrder(freshScenes);
  const publicLevels = buildPublicTrainTourLevels(cars, zones, sortedScenes);

  return {
    slug: train.slug,
    name: train.name,
    description: train.description ?? undefined,
    formation: train.formation ?? undefined,
    imageUrl: train.imageUrl ?? undefined,
    levels: publicLevels,
    scenes: sortedScenes.map((scene) => ({
      id: scene.sceneId,
      title: scene.title,
      panoramaUrl: scene.panoramaUrl,
      multiRes: extractMultiResFromCanvasData(scene.canvasData),
      levelId: scene.carId,
      areaId: scene.zoneId,
      levelSlug: scene.car,
      hotspots: normalizeHotspots(scene.hotspots),
      privacyBlurs: extractPrivacyBlursFromCanvasData(scene.canvasData),
      initialView: extractInitialViewFromCanvasData(scene.canvasData),
    })),
  };
}

export const getTrainBySlug = cache(async (slug: string): Promise<TrainInfo | null> => {
  const train = await prisma.train.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      formation: true,
      imageUrl: true,
    },
  });
  if (!train) return null;
  await ensureTrainTourStructure(train.id);
  return mapTrainToInfo(train);
});

export const getTrainMetaBySlug = cache(async (slug: string) => {
  try {
    return await prisma.train.findFirst({
      where: { slug, isActive: true },
      select: { name: true },
    });
  } catch {
    return null;
  }
});

export async function getAllTrainsForPicker() {
  try {
    return await prisma.train.findMany({
      where: {
        isActive: true,
        trainTourScenes: { some: { isActive: true } },
      },
      orderBy: { order: "asc" },
      select: {
        slug: true,
        name: true,
        formation: true,
        imageUrl: true,
      },
    });
  } catch {
    return [];
  }
}
