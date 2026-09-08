import { prisma } from "@/lib/prisma";
import { STATION_PICKER_ENTRY } from "@/lib/tour-nav";

export async function getDefaultStationTourSlug() {
  try {
    const station = await prisma.station.findFirst({
      where: {
        isActive: true,
        virtualTourScenes: { some: { isActive: true } },
      },
      orderBy: { order: "asc" },
      select: { slug: true },
    });
    return station?.slug ?? null;
  } catch {
    return null;
  }
}

export async function getDefaultStationTourHref() {
  return STATION_PICKER_ENTRY;
}
