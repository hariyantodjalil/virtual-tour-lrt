import { prisma } from "@/lib/prisma";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import StationsMediaGrid from "./StationsMediaGrid";

export const dynamic = "force-dynamic";

async function getStations() {
  try {
    return await prisma.station.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { commercialSpaces: true, virtualTourScenes: true } } },
    });
  } catch {
    return [];
  }
}

export default async function CmsStationsPage() {
  const stations = await getStations();

  return (
    <StationsMediaGrid
      stations={stations.map((station) => ({
        id: station.id,
        name: station.name,
        address: station.address,
        imageUrl: station.imageUrl,
        isActive: station.isActive,
        imageSrc: station.imageUrl ? getS3ProxyUrl(station.imageUrl) : null,
        commercialSpaces: station._count.commercialSpaces,
        virtualTourScenes: station._count.virtualTourScenes,
      }))}
    />
  );
}
