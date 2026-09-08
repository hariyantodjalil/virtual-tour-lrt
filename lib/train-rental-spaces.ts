import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePublicAssetUrl } from "@/lib/s3-utils";
import { ensureDefaultTrain } from "@/lib/default-train";
import {
  DEFAULT_TRAIN_RENTAL_SPACES,
  type TrainRentalSpaceCms,
  type TrainRentalSpacePublic,
} from "@/lib/train-rental-spaces-shared";
import {
  isTrainRentalStatus,
  parseCarTrainsetMap,
  unionCarTrainsets,
  type TrainRentalStatus,
} from "@/lib/train-rental-sales";

export type { TrainRentalSpaceCms, TrainRentalSpacePublic };
export { DEFAULT_TRAIN_RENTAL_SPACES };

type TrainRentalSalesRow = {
  id: string;
  availableTrainsets: string[];
  availableByCar: unknown;
  howToOrder: string | null;
  status: string;
  monthlyRent: number | null;
};

let availableByCarReady = false;

async function ensureAvailableByCarColumn() {
  if (availableByCarReady) return;
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "train_rental_spaces"
    ADD COLUMN IF NOT EXISTS "availableByCar" JSONB NOT NULL DEFAULT '{}'::jsonb
  `);
  availableByCarReady = true;
}

export async function fetchTrainRentalSalesMap(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map<string, TrainRentalSalesRow>();

  await ensureAvailableByCarColumn();

  const rows = await prisma.$queryRaw<TrainRentalSalesRow[]>`
    SELECT
      id,
      COALESCE("availableTrainsets", '{}'::text[]) AS "availableTrainsets",
      COALESCE("availableByCar", '{}'::jsonb) AS "availableByCar",
      "howToOrder",
      status::text AS status,
      "monthlyRent"
    FROM "train_rental_spaces"
    WHERE id IN (${Prisma.join(unique)})
  `;

  return new Map(rows.map((row) => [row.id, row]));
}

export async function writeTrainRentalSalesFields(
  id: string,
  data: {
    availableTrainsets: string[];
    availableByCar?: unknown;
    howToOrder: string | null;
    status: TrainRentalStatus;
    monthlyRent: number | null;
  }
) {
  const byCar = parseCarTrainsetMap(data.availableByCar, data.availableTrainsets);
  const trainsets = unionCarTrainsets(byCar);
  await ensureAvailableByCarColumn();
  const trainsetSql =
    trainsets.length === 0
      ? Prisma.sql`'{}'::text[]`
      : Prisma.sql`ARRAY[${Prisma.join(trainsets)}]::text[]`;

  await prisma.$executeRaw`
    UPDATE "train_rental_spaces"
    SET
      "availableTrainsets" = ${trainsetSql},
      "availableByCar" = ${JSON.stringify(byCar)}::jsonb,
      "howToOrder" = ${data.howToOrder},
      "status" = CAST(${data.status} AS "TrainRentalStatus"),
      "monthlyRent" = ${data.monthlyRent},
      "updatedAt" = NOW()
    WHERE id = ${id}
  `;
}

function withSalesFields<T extends { id: string }>(
  space: T,
  sales?: TrainRentalSalesRow
) {
  const availableByCar = parseCarTrainsetMap(
    sales?.availableByCar,
    sales?.availableTrainsets ?? []
  );
  return {
    ...space,
    availableTrainsets: unionCarTrainsets(availableByCar),
    availableByCar,
    howToOrder: sales?.howToOrder ?? null,
    status: isTrainRentalStatus(sales?.status) ? sales.status : "TERSEDIA",
    monthlyRent: sales?.monthlyRent ?? null,
  };
}

export function trainLeadRequirement(space: {
  id: string;
  displayNumber: string;
  title: string;
}) {
  return `TRAIN:${space.id} | ${space.displayNumber} | ${space.title}`.slice(0, 500);
}

export async function findTrainRentalSpaceForLead(idOrNumber: string) {
  return prisma.trainRentalSpace.findFirst({
    where: {
      isActive: true,
      OR: [{ id: idOrNumber }, { displayNumber: idOrNumber }],
    },
    select: {
      id: true,
      displayNumber: true,
      title: true,
    },
  });
}

function toPublicSpace(space: {
  id: string;
  displayNumber: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  objectPosition: string;
  availableTrainsets?: string[];
  availableByCar?: unknown;
  howToOrder?: string | null;
  status?: TrainRentalStatus | string;
  monthlyRent?: number | null;
}): TrainRentalSpacePublic {
  const fallback =
    DEFAULT_TRAIN_RENTAL_SPACES.find((item) => item.displayNumber === space.displayNumber) ??
    DEFAULT_TRAIN_RENTAL_SPACES[0];
  const availableByCar = parseCarTrainsetMap(space.availableByCar, space.availableTrainsets ?? []);

  return {
    id: space.id,
    displayNumber: space.displayNumber,
    title: space.title,
    description: space.description,
    image: resolvePublicAssetUrl(space.imageUrl?.trim() || fallback.image),
    objectPosition: space.objectPosition || fallback.objectPosition,
    availableTrainsets: unionCarTrainsets(availableByCar),
    availableByCar,
    howToOrder: space.howToOrder ?? null,
    status: isTrainRentalStatus(space.status) ? space.status : "TERSEDIA",
    monthlyRent: space.monthlyRent ?? null,
  };
}

export async function ensureDefaultTrainRentalSpaces(trainId: string) {
  const count = await prisma.trainRentalSpace.count({ where: { trainId } });
  if (count > 0) return;

  await prisma.trainRentalSpace.createMany({
    data: DEFAULT_TRAIN_RENTAL_SPACES.map((space) => ({
      trainId,
      displayNumber: space.displayNumber,
      title: space.title,
      description: space.description,
      imageUrl: space.image,
      objectPosition: space.objectPosition,
      order: space.order,
      isActive: true,
    })),
  });
}

export const getTrainRentalSpaces = cache(async (): Promise<TrainRentalSpacePublic[]> => {
  try {
    const train = await ensureDefaultTrain();
    await ensureDefaultTrainRentalSpaces(train.id);

    const spaces = await prisma.trainRentalSpace.findMany({
      where: { trainId: train.id, isActive: true },
      orderBy: { order: "asc" },
    });

    if (spaces.length === 0) {
      return DEFAULT_TRAIN_RENTAL_SPACES.map((space) => ({
        id: space.displayNumber,
        displayNumber: space.displayNumber,
        title: space.title,
        description: space.description,
        image: space.image,
        objectPosition: space.objectPosition,
        availableTrainsets: [...space.availableTrainsets],
        availableByCar: { ...space.availableByCar },
        howToOrder: space.howToOrder,
        status: space.status,
        monthlyRent: space.monthlyRent,
      }));
    }

    const sales = await fetchTrainRentalSalesMap(spaces.map((space) => space.id));
    return spaces.map((space) => toPublicSpace(withSalesFields(space, sales.get(space.id))));
  } catch (error) {
    console.error("[train-rental-spaces] fallback to default carousel", error);
    return DEFAULT_TRAIN_RENTAL_SPACES.map((space) => ({
      id: space.displayNumber,
      displayNumber: space.displayNumber,
      title: space.title,
      description: space.description,
      image: space.image,
      objectPosition: space.objectPosition,
      availableTrainsets: [...space.availableTrainsets],
      availableByCar: { ...space.availableByCar },
      howToOrder: space.howToOrder,
      status: space.status,
      monthlyRent: space.monthlyRent,
    }));
  }
});

export async function getTrainRentalSpacesForCms(): Promise<TrainRentalSpaceCms[]> {
  const train = await ensureDefaultTrain();
  await ensureDefaultTrainRentalSpaces(train.id);

  const spaces = await prisma.trainRentalSpace.findMany({
    where: { trainId: train.id },
    orderBy: { order: "asc" },
  });
  const sales = await fetchTrainRentalSalesMap(spaces.map((space) => space.id));

  return spaces.map((space) => {
    const publicSpace = toPublicSpace(withSalesFields(space, sales.get(space.id)));
    return {
      ...publicSpace,
      order: space.order,
      isActive: space.isActive,
      imageUrl: space.imageUrl,
    };
  });
}
