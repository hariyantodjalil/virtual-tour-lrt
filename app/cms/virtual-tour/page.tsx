import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cmsUi } from "@/lib/cms-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map } from "lucide-react";

export const dynamic = "force-dynamic";

async function getStations() {
  try {
    return await prisma.station.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { virtualTourScenes: true } },
      },
    });
  } catch {
    return [];
  }
}

export default async function CmsVirtualTourIndexPage() {
  const stations = await getStations();

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        {stations.map((s) => (
          <Card key={s.id} className={cmsUi.card}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#F8ECEE]">{s.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className={`text-sm ${cmsUi.muted}`}>{s._count.virtualTourScenes} scene</span>
              <Button asChild size="sm" className={cmsUi.primaryBtn}>
                <Link href={`/cms/virtual-tour/${s.id}`}>
                  <Map className="mr-1 h-3 w-3" /> Edit
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {stations.length === 0 && <p className={cmsUi.muted}>Belum ada stasiun.</p>}
    </div>
  );
}
