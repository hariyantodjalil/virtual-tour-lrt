import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { cmsUi } from "@/lib/cms-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Map } from "lucide-react";
import StationActions from "./StationActions";

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
    <div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => (
          <Card key={station.id} className={cmsUi.card}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base text-[#F8ECEE]">{station.name}</CardTitle>
                <Badge
                  variant="outline"
                  className={station.isActive ? cmsUi.successBadge : cmsUi.inactiveBadge}
                >
                  {station.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              <p className={`text-xs ${cmsUi.muted}`}>{station.address}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {station.imageUrl && (
                <div className={`relative h-32 overflow-hidden rounded-lg ${cmsUi.surface}`}>
                  <Image
                    src={getS3ProxyUrl(station.imageUrl)}
                    alt={station.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  />
                </div>
              )}
              <p className={`text-sm ${cmsUi.muted}`}>
                {station._count.commercialSpaces} unit · {station._count.virtualTourScenes} scene
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className={cmsUi.outlineBtn}>
                  <Link href={`/cms/stations/${station.id}`}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Link>
                </Button>
                <Button asChild size="sm" className={cmsUi.primaryBtn}>
                  <Link href={`/cms/virtual-tour/${station.id}`}>
                    <Map className="mr-1 h-3 w-3" /> Station Virtual Tour
                  </Link>
                </Button>
              </div>
              <StationActions
                station={{
                  id: station.id,
                  name: station.name,
                  isActive: station.isActive,
                }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      {stations.length === 0 && <p className={cmsUi.muted}>Belum ada stasiun.</p>}
    </div>
  );
}
