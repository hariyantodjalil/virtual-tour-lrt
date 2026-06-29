import { prisma } from "@/lib/prisma";
import { getStationBySlug } from "@/lib/stations-data";
import RetailLookbookClient from "@/components/RetailLookbookClient";
import type { StationInfo } from "@/lib/stations-data";
import {
  getFallbackLandingStations,
  getFallbackTourDataMap,
  type LandingStation,
} from "@/lib/landing-data";

export const dynamic = "force-dynamic";

async function getLandingData(): Promise<{
  stations: LandingStation[];
  tourDataMap: Record<string, StationInfo>;
}> {
  const stationsData = await prisma.station.findMany({
    orderBy: { order: "asc" },
    include: {
      commercialSpaces: true,
    },
  });

  const stations = stationsData.map((s): LandingStation => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    line: s.line,
    dailyPassengers: s.dailyPassengers,
    spaces: s.commercialSpaces.map((space) => ({
      id: space.id,
      code: space.code,
      name: space.name,
      type: space.type,
      status: space.status,
      area: space.area,
      monthlyRent: space.monthlyRent,
      deposit: space.deposit,
      floor: space.floor,
      location: space.location,
      nearestExit: space.nearestExit,
      exposure: space.exposure,
      powerSupply: space.powerSupply,
      waterAccess: space.waterAccess,
      airConditioning: space.airConditioning,
      description: space.description,
    })),
  }));

  const tourDataMap: Record<string, StationInfo> = {};
  for (const st of stations) {
    const tourData = await getStationBySlug(st.slug);
    if (tourData) {
      tourDataMap[st.slug] = tourData;
    }
  }

  return { stations, tourDataMap };
}

async function getSafeLandingData() {
  try {
    return await getLandingData();
  } catch {
    return {
      stations: getFallbackLandingStations(),
      tourDataMap: getFallbackTourDataMap(),
    };
  }
}

export default async function B2BDashboardPage() {
  const { stations, tourDataMap } = await getSafeLandingData();

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8F9FA]">
      <RetailLookbookClient stations={stations} tourDataMap={tourDataMap} />
    </div>
  );
}
