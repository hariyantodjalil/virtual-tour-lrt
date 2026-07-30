import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StationEditClient from "./StationEditClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CmsStationEditPage({ params }: Props) {
  const { id } = await params;
  const station = await prisma.station.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      line: true,
      address: true,
      location: true,
      dailyPassengers: true,
      description: true,
      commercialContactPhone: true,
      imageUrl: true,
      order: true,
      isActive: true,
    },
  });

  if (!station) notFound();

  return <StationEditClient initialStation={station} />;
}
