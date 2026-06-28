"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getS3ProxyUrl } from "@/lib/s3-utils";
import { Pencil, Map } from "lucide-react";

type Station = {
  id: string;
  name: string;
  slug: string;
  line: string;
  address: string;
  dailyPassengers: number;
  imageUrl: string | null;
  _count: { commercialSpaces: number; virtualTourScenes: number };
};

export default function CmsStationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cms/stations")
      .then((r) => r.json())
      .then(setStations)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400">Memuat stasiun...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Stasiun</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => (
          <Card key={station.id} className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{station.name}</CardTitle>
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
                    unoptimized
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
                    <Map className="h-3 w-3 mr-1" /> Virtual Tour
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
