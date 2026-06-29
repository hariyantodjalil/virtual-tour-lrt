import { prisma } from "@/lib/prisma";
import { getStationBySlug } from "@/lib/stations-data";
import RetailLookbookClient from "@/components/RetailLookbookClient";
import type { StationInfo } from "@/lib/stations-data";

export const dynamic = "force-dynamic";

export default async function B2BDashboardPage() {
  // Fetch all stations with their commercial spaces
  const stationsData = await prisma.station.findMany({
    orderBy: { order: "asc" },
    include: {
      commercialSpaces: true,
    },
  });

  // Map to a clean, serializable summary
  const stations = stationsData.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    line: s.line,
    dailyPassengers: s.dailyPassengers,
    spaces: s.commercialSpaces,
  }));

  // Fetch all virtual tour scene data for all stations so the client doesn't need to load them
  const tourDataMap: Record<string, StationInfo> = {};
  for (const st of stations) {
    const tourData = await getStationBySlug(st.slug);
    if (tourData) {
      tourDataMap[st.slug] = tourData;
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8F9FA]">
      <RetailLookbookClient stations={stations} tourDataMap={tourDataMap} />
    </div>
  );
}
