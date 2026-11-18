"use client";

import Link from "next/link";
import Image from "next/image";
import { cmsUi } from "@/lib/cms-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Map, MapPin, Pencil } from "lucide-react";
import CmsMediaSearch from "@/components/cms/CmsMediaSearch";
import StationActions from "./StationActions";

export type StationMediaItem = {
  id: string;
  name: string;
  address: string;
  imageUrl: string | null;
  isActive: boolean;
  imageSrc: string | null;
  commercialSpaces: number;
  virtualTourScenes: number;
};

export default function StationsMediaGrid({ stations }: { stations: StationMediaItem[] }) {
  return (
    <CmsMediaSearch
      items={stations}
      placeholder="Cari stasiun…"
      emptyLabel="Belum ada stasiun."
      getSearchText={(station) =>
        [station.name, station.address, station.isActive ? "" : "nonaktif"].join(" ")
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
                {!station.isActive ? (
                  <Badge
                    variant="outline"
                    className={`absolute right-3 top-3 ${cmsUi.inactiveBadge} bg-[var(--work-surface)]/95`}
                  >
                    Nonaktif
                  </Badge>
                ) : null}
              </div>

              <CardContent className="space-y-3 p-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-[var(--work-text)]">
                    {station.name}
                  </h2>
                  <p className={`mt-0.5 line-clamp-1 text-xs ${cmsUi.muted}`}>{station.address}</p>
                </div>

                <p className={`text-sm ${cmsUi.muted}`}>
                  {station.commercialSpaces} unit · {station.virtualTourScenes} scene
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className={cmsUi.outlineBtn}>
                    <Link href={`/cms/stations/${station.id}`}>
                      <Pencil className="mr-1 size-3.5" />
                      Edit
                    </Link>
                  </Button>
                  <Button asChild size="sm" className={cmsUi.primaryBtn}>
                    <Link href={`/cms/virtual-tour/${station.id}`}>
                      <Map className="mr-1 size-3.5" />
                      Virtual Tour
                    </Link>
                  </Button>
                  <StationActions
                    station={{
                      id: station.id,
                      name: station.name,
                      isActive: station.isActive,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CmsMediaSearch>
  );
}
