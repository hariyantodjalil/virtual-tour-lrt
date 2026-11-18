"use client";

import Link from "next/link";
import Image from "next/image";
import { cmsUi } from "@/lib/cms-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Map, MapPin } from "lucide-react";
import CmsMediaSearch from "@/components/cms/CmsMediaSearch";

export type VirtualTourStationItem = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  imageSrc: string | null;
  sceneCount: number;
};

export default function VirtualTourIndexMediaGrid({
  stations,
}: {
  stations: VirtualTourStationItem[];
}) {
  return (
    <CmsMediaSearch
      items={stations}
      placeholder="Cari stasiun atau scene…"
      emptyLabel="Belum ada stasiun."
      getSearchText={(station) =>
        [
          station.name,
          station.address,
          `${station.sceneCount} scene`,
          station.sceneCount === 0 ? "belum ada scene" : "",
          station.isActive ? "" : "nonaktif",
        ].join(" ")
      }
    >
      {(filtered) => (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((station) => (
            <Card key={station.id} className={`overflow-hidden p-0 ${cmsUi.card}`}>
              <div className={`relative aspect-[16/10] ${cmsUi.void}`}>
                {station.imageSrc ? (
                  <Image
                    src={station.imageSrc}
                    alt={station.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    unoptimized
                  />
                ) : (
                  <div className={`flex h-full items-center justify-center ${cmsUi.muted}`}>
                    <MapPin className="size-8 opacity-40" />
                  </div>
                )}
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  {station.sceneCount === 0 ? (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-[var(--work-surface)]/95 text-amber-900"
                    >
                      Belum ada scene
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-transparent bg-[var(--work-surface)]/95 text-[var(--work-text)]"
                    >
                      {station.sceneCount} scene
                    </Badge>
                  )}
                  {!station.isActive ? (
                    <Badge
                      variant="outline"
                      className={`bg-[var(--work-surface)]/95 ${cmsUi.inactiveBadge}`}
                    >
                      Nonaktif
                    </Badge>
                  ) : null}
                </div>
              </div>

              <CardContent className="flex items-end justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold tracking-tight text-[var(--work-text)]">
                    {station.name}
                  </h2>
                  <p className={`mt-0.5 line-clamp-1 text-xs ${cmsUi.muted}`}>{station.address}</p>
                </div>
                <Button asChild size="sm" className={cmsUi.primaryBtn}>
                  <Link href={`/cms/virtual-tour/${station.id}`}>
                    <Map className="mr-1 size-3.5" />
                    Edit Tur
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CmsMediaSearch>
  );
}
