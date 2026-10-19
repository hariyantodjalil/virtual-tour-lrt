import Link from "next/link";
import { prisma } from "@/lib/prisma";
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
      <h1 className="text-2xl font-bold mb-6">Station Virtual Tour Editor</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {stations.map((s) => (
          <Card key={s.id} className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{s.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{s._count.virtualTourScenes} scene</span>
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500">
                <Link href={`/cms/virtual-tour/${s.id}`}>
                  <Map className="h-3 w-3 mr-1" /> Edit
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {stations.length === 0 && <p className="text-slate-400">Belum ada stasiun.</p>}
    </div>
  );
}
