import type { Prisma } from "@prisma/client";
import type { FavoriteSpace } from "@/lib/favorite-spaces";

export const partnerFavoriteSelect = {
  createdAt: true,
  space: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      status: true,
      area: true,
      location: true,
      floor: true,
      panoramaUrl: true,
      station: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.PartnerFavoriteSelect;

export type PartnerFavoriteRecord = Prisma.PartnerFavoriteGetPayload<{
  select: typeof partnerFavoriteSelect;
}>;

export function toFavoriteSpace(record: PartnerFavoriteRecord): FavoriteSpace {
  return {
    spaceId: record.space.id,
    code: record.space.code,
    name: record.space.name,
    type: record.space.type,
    status: record.space.status,
    area: record.space.area,
    location: record.space.location,
    floor: record.space.floor,
    panoramaUrl: record.space.panoramaUrl,
    stationSlug: record.space.station.slug,
    stationName: record.space.station.name,
    savedAt: record.createdAt.toISOString(),
  };
}
