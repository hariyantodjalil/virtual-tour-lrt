import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { StationInfo } from "@/lib/tour-types";
import { normalizeHotspots } from "@/lib/hotspot-normalize";
import { extractPrivacyBlursFromCanvasData } from "@/lib/privacy-blur-normalize";
import { extractInitialViewFromCanvasData } from "@/lib/scene-initial-view";
import { sortScenesByTourOrder } from "@/lib/virtual-tour-structure";
import { buildPublicTourLevels } from "@/lib/public-tour-structure";

export type { Hotspot, PanoramaScene, StationInfo, TourLevelPublic, TourAreaPublic } from "@/lib/tour-types";
export type { PrivacyBlur } from "@/lib/privacy-blur-types";

type StationRow = {
  id: string;
  slug: string;
  name: string;
  code: string | null;
  line: string;
  order: number;
  dailyPassengers: number;
  address: string;
  commercialContactPhone: string | null;
};

async function mapStationToInfo(station: StationRow): Promise<StationInfo> {
  const [levels, areas, freshScenes] = await Promise.all([
    prisma.virtualTourLevel.findMany({
      where: { stationId: station.id, isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.virtualTourArea.findMany({
      where: { stationId: station.id, isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.virtualTourScene.findMany({
      where: { stationId: station.id, isActive: true },
      include: {
        levelRef: { select: { order: true } },
        areaRef: { select: { order: true } },
      },
      orderBy: { order: "asc" },
    }),
  ]);

  const sortedScenes = sortScenesByTourOrder(freshScenes);
  const publicLevels = buildPublicTourLevels(levels, areas, sortedScenes);

  return {
    slug: station.slug,
    name: station.name,
    code: station.code ?? undefined,
    line: station.line,
    order: station.order,
    dailyPassengers: station.dailyPassengers,
    address: station.address,
    commercialContactPhone: station.commercialContactPhone ?? undefined,
    levels: publicLevels,
    scenes: sortedScenes.map((scene) => ({
      id: scene.sceneId,
      title: scene.title,
      panoramaUrl: scene.panoramaUrl,
      thumbnailUrl: scene.thumbnailUrl ?? undefined,
      levelId: scene.levelId,
      areaId: scene.areaId,
      levelSlug: scene.level,
      hotspots: normalizeHotspots(scene.hotspots),
      privacyBlurs: extractPrivacyBlursFromCanvasData(scene.canvasData),
      initialView: extractInitialViewFromCanvasData(scene.canvasData),
    })),
  };
}

export async function getAllStationsData(): Promise<StationInfo[]> {
  const stations = await prisma.station.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      code: true,
      line: true,
      order: true,
      dailyPassengers: true,
      address: true,
      commercialContactPhone: true,
    },
  });
  return Promise.all(stations.map((station) => mapStationToInfo(station)));
}

export const getStationBySlug = cache(async (slug: string): Promise<StationInfo | null> => {
  const station = await prisma.station.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      code: true,
      line: true,
      order: true,
      dailyPassengers: true,
      address: true,
      commercialContactPhone: true,
    },
  });
  if (!station) return null;
  return mapStationToInfo(station);
});

/** Metadata ringan — tanpa load scene/hotspot. */
export const getStationMetaBySlug = cache(async (slug: string) => {
  try {
    return await prisma.station.findFirst({
      where: { slug, isActive: true },
      select: { name: true },
    });
  } catch {
    return null;
  }
});

export async function getStationSlugs(): Promise<string[]> {
  const stations = await prisma.station.findMany({
    where: { isActive: true },
    select: { slug: true },
    orderBy: { order: "asc" },
  });
  return stations.map((s) => s.slug);
}
