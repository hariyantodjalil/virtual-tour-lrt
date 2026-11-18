"use client";

import Link from "next/link";
import Image from "next/image";
import { cmsUi } from "@/lib/cms-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Store } from "lucide-react";
import CmsMediaSearch from "@/components/cms/CmsMediaSearch";

export type SpaceStationMediaItem = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  imageSrc: string | null;
  unitCount: number;
};

export default function SpacesIndexMediaGrid({ stations }: { stations: SpaceStationMediaItem[] }) {
  return (
    <CmsMediaSearch
      items={stations}
      placeholder="Cari stasiun…"
      emptyLabel="Belum ada stasiun."
      getSearchText={(station) =>
        [station.name, station.address, String(station.unitCount), station.isActive ? "" : "nonaktif"].join(
          " "
        )
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
              </div>

              <CardContent className="flex items-end justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold tracking-tight text-[var(--work-text)]">
                    {station.name}
                  </h2>
                  <p className={`mt-0.5 text-sm ${cmsUi.muted}`}>
                    {station.unitCount} unit
                    {!station.isActive ? " · nonaktif" : ""}
                  </p>
                </div>
                <Button asChild size="sm" className={cmsUi.primaryBtn}>
                  <Link href={`/cms/spaces/${station.id}`}>
                    <Store className="mr-1 size-3.5" />
                    Kelola
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
