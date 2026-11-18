import { prisma } from "@/lib/prisma";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import VirtualTourIndexMediaGrid from "./VirtualTourIndexMediaGrid";

export const dynamic = "force-dynamic";

async function getStations() {
  try {
    return await prisma.station.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        imageUrl: true,
        isActive: true,
        _count: { select: { virtualTourScenes: true } },
      },
    });
  } catch {
    return [];
  }
}

export default async function CmsVirtualTourIndexPage() {
  const stations = await getStations();

  return (
    <VirtualTourIndexMediaGrid
      stations={stations.map((station) => ({
        id: station.id,
        name: station.name,
        address: station.address,
        isActive: station.isActive,
        imageSrc: station.imageUrl ? getS3ProxyUrl(station.imageUrl) : null,
        sceneCount: station._count.virtualTourScenes,
      }))}
    />
  );
}
