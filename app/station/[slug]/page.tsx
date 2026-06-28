import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStationBySlug, getStationSlugs } from "@/lib/stations-data";
import StationTourClient from "./StationTourClient";
import Navbar from "@/components/Navbar";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const slugs = await getStationSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const station = await getStationBySlug(slug);
  if (!station) return { title: "Stasiun Tidak Ditemukan" };
  return {
    title: `Virtual Tour ${station.name} - LRT Jabodebek`,
    description: `Eksplorasi ruang komersial Stasiun ${station.name} LRT Jabodebek secara virtual 360°.`,
  };
}

async function getStationData(slug: string) {
  try {
    return await prisma.station.findUnique({
      where: { slug },
      include: {
        commercialSpaces: {
          orderBy: [{ floor: "asc" }, { code: "asc" }],
        },
      },
    });
  } catch {
    return null;
  }
}

export default async function StationPage({ params }: Props) {
  const { slug } = await params;
  const stationInfo = await getStationBySlug(slug);
  if (!stationInfo || stationInfo.scenes.length === 0) notFound();

  const stationData = await getStationData(slug);

  if (stationData) {
    await prisma.visitEvent
      .create({
        data: {
          stationId: stationData.id,
          eventType: "STATION_VIEW",
        },
      })
      .catch(() => null);
  }

  const spaces = stationData?.commercialSpaces ?? [];

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <Navbar />
      <StationTourClient
        stationInfo={stationInfo}
        spaces={spaces.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          type: s.type,
          status: s.status as "TERSEDIA" | "TERISI" | "MAINTENANCE",
          area: s.area,
          monthlyRent: s.monthlyRent,
          deposit: s.deposit,
          floor: s.floor,
          location: s.location,
          nearestExit: s.nearestExit,
          exposure: s.exposure,
          powerSupply: s.powerSupply,
          waterAccess: s.waterAccess,
          airConditioning: s.airConditioning,
          description: s.description,
        }))}
      />
    </div>
  );
}
