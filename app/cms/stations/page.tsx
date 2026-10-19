import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getS3ProxyUrl } from "@/lib/s3-utils";
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Stasiun</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => (
          <Card key={station.id} className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">{station.name}</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    station.isActive
                      ? "border-emerald-700 bg-emerald-950/50 text-emerald-300"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }
                >
                  {station.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">{station.address}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {station.imageUrl && (
                <div className="relative h-32 rounded-lg overflow-hidden bg-slate-800">
                  <Image
                    src={getS3ProxyUrl(station.imageUrl)}
                    alt={station.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  />
                </div>
              )}
              <p className="text-sm text-slate-400">
                {station._count.commercialSpaces} unit · {station._count.virtualTourScenes} scene
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="border-slate-700">
                  <Link href={`/cms/stations/${station.id}`}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Link>
                </Button>
                <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500">
                  <Link href={`/cms/virtual-tour/${station.id}`}>
                    <Map className="h-3 w-3 mr-1" /> Station Virtual Tour
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
      {stations.length === 0 && <p className="text-slate-400">Belum ada stasiun.</p>}
    </div>
  );
}
