import { prisma } from "@/lib/prisma";
import type { Hotspot, PanoramaScene, StationInfo } from "@/lib/tour-types";

export type { Hotspot, PanoramaScene, StationInfo } from "@/lib/tour-types";

export async function getAllStationsData(): Promise<StationInfo[]> {
  const stations = await prisma.station.findMany({
    orderBy: { order: "asc" },
    include: {
      virtualTourScenes: {
        where: { isActive: true },
        orderBy: { order: "asc" },
      },
    },
  });

  return stations.map((station) => ({
    slug: station.slug,
    name: station.name,
    code: station.code ?? undefined,
    line: station.line,
    order: station.order,
    dailyPassengers: station.dailyPassengers,
    address: station.address,
    scenes: station.virtualTourScenes.map((scene) => ({
      id: scene.sceneId,
      title: scene.title,
      panoramaUrl: scene.panoramaUrl,
      thumbnailUrl: scene.thumbnailUrl ?? undefined,
      hotspots: (scene.hotspots as Hotspot[]) ?? [],
    })),
  }));
}

export async function getStationBySlug(slug: string): Promise<StationInfo | null> {
  const station = await prisma.station.findUnique({
    where: { slug },
    include: {
      virtualTourScenes: {
        where: { isActive: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!station) return null;

  return {
    slug: station.slug,
    name: station.name,
    code: station.code ?? undefined,
    line: station.line,
    order: station.order,
    dailyPassengers: station.dailyPassengers,
    address: station.address,
    scenes: station.virtualTourScenes.map((scene) => ({
      id: scene.sceneId,
      title: scene.title,
      panoramaUrl: scene.panoramaUrl,
      thumbnailUrl: scene.thumbnailUrl ?? undefined,
      hotspots: (scene.hotspots as Hotspot[]) ?? [],
    })),
  };
}

// Backward compat sync helper for generateStaticParams
export async function getStationSlugs(): Promise<string[]> {
  const stations = await prisma.station.findMany({ select: { slug: true }, orderBy: { order: "asc" } });
  return stations.map((s) => s.slug);
}
