import { after } from "next/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStationBySlug, getStationMetaBySlug } from "@/lib/stations-data";
import StationTourClient from "./StationTourClient";

// Selalu render fresh dari DB — tidak pakai static generation
// agar perubahan data di CMS langsung terlihat di halaman publik
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const station = await getStationMetaBySlug(slug);
  if (!station) return { title: "Stasiun Tidak Ditemukan" };
  return {
    title: `Virtual Tour ${station.name} - LRT Jabodebek`,
    description: `Eksplorasi ruang komersial Stasiun ${station.name} LRT Jabodebek secara virtual 360°.`,
  };
}

async function getStationData(slug: string) {
  try {
    return await prisma.station.findFirst({
      where: { slug, isActive: true },
      include: {
        commercialSpaces: {
          orderBy: [{ floor: "asc" }, { code: "asc" }],
          include: {
            occupancy: {
              include: {
                tenant: { select: { brandName: true, logoUrl: true, isActive: true } },
              },
            },
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export default async function StationPage({ params }: Props) {
  const { slug } = await params;
  const [stationInfo, stationData] = await Promise.all([
    getStationBySlug(slug),
    getStationData(slug),
  ]);

  if (!stationInfo || stationInfo.scenes.length === 0) notFound();

  if (stationData) {
    const stationId = stationData.id;
    after(() => {
      void prisma.visitEvent
        .create({
          data: {
            stationId,
            eventType: "STATION_VIEW",
          },
        })
        .catch(() => null);
    });
  }

  const spaces = stationData?.commercialSpaces ?? [];

  return (
    <div className="relative h-dvh overflow-hidden bg-[#1C0A0E]">
      <StationTourClient
        stationInfo={stationInfo}
        spaces={spaces.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          type: s.type,
          status: s.status as "TERSEDIA" | "TERISI" | "MAINTENANCE",
          area: s.area,
          deposit: s.deposit,
          floor: s.floor,
          location: s.location,
          nearestExit: s.nearestExit,
          exposure: s.exposure,
          powerSupply: s.powerSupply,
          waterAccess: s.waterAccess,
          airConditioning: s.airConditioning,
          description: s.description,
          tenantBrand:
            s.occupancy?.tenant?.isActive !== false
              ? s.occupancy?.tenant?.brandName ?? null
              : null,
        }))}
      />
    </div>
  );
}
