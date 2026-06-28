"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store } from "lucide-react";

type Station = {
  id: string;
  name: string;
  _count: { commercialSpaces: number };
};

export default function CmsSpacesIndexPage() {
  const [stations, setStations] = useState<Station[]>([]);

  useEffect(() => {
    fetch("/api/cms/stations").then((r) => r.json()).then(setStations);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ruang Komersial</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {stations.map((s) => (
          <Card key={s.id} className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-base">{s.name}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{s._count.commercialSpaces} unit</span>
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500">
                <Link href={`/cms/spaces/${s.id}`}><Store className="h-3 w-3 mr-1" /> Kelola</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
