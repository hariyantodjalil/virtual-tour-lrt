import { prisma } from "@/lib/prisma";
import type { StationPickerItem } from "@/components/tour/StationPickerModal";

/** Daftar stasiun aktif yang punya virtual tour — untuk picker & landing. */
export async function getPickerStations(): Promise<StationPickerItem[]> {
  try {
    return await prisma.station.findMany({
      where: {
        isActive: true,
        virtualTourScenes: { some: { isActive: true } },
      },
      orderBy: { order: "asc" },
      select: {
        slug: true,
        name: true,
        order: true,
        line: true,
        address: true,
        location: true,
        dailyPassengers: true,
      },
    });
  } catch {
    return [];
  }
}
