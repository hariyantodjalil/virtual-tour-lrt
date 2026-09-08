import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTrain } from "@/lib/default-train";
import {
  DEFAULT_TRAIN_RENTAL_SPACES,
  type TrainRentalSpaceCms,
  type TrainRentalSpacePublic,
} from "@/lib/train-rental-spaces-shared";

export type { TrainRentalSpaceCms, TrainRentalSpacePublic };
export { DEFAULT_TRAIN_RENTAL_SPACES };

function toPublicSpace(space: {
  id: string;
  displayNumber: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  objectPosition: string;
}): TrainRentalSpacePublic {
  const fallback =
    DEFAULT_TRAIN_RENTAL_SPACES.find((item) => item.displayNumber === space.displayNumber) ??
    DEFAULT_TRAIN_RENTAL_SPACES[0];

  return {
    id: space.id,
    displayNumber: space.displayNumber,
    title: space.title,
    description: space.description,
    image: space.imageUrl?.trim() || fallback.image,
    objectPosition: space.objectPosition || fallback.objectPosition,
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
  const train = await ensureDefaultTrain();
  await ensureDefaultTrainRentalSpaces(train.id);

  const spaces = await prisma.trainRentalSpace.findMany({
    where: { trainId: train.id, isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      displayNumber: true,
      title: true,
      description: true,
      imageUrl: true,
      objectPosition: true,
    },
  });

  if (spaces.length === 0) {
    return DEFAULT_TRAIN_RENTAL_SPACES.map((space) => ({
      id: space.displayNumber,
      displayNumber: space.displayNumber,
      title: space.title,
      description: space.description,
      image: space.image,
      objectPosition: space.objectPosition,
    }));
  }

  return spaces.map(toPublicSpace);
});

export async function getTrainRentalSpacesForCms(): Promise<TrainRentalSpaceCms[]> {
  const train = await ensureDefaultTrain();
  await ensureDefaultTrainRentalSpaces(train.id);

  const spaces = await prisma.trainRentalSpace.findMany({
    where: { trainId: train.id },
    orderBy: { order: "asc" },
  });

  return spaces.map((space) => ({
    ...toPublicSpace(space),
    order: space.order,
    isActive: space.isActive,
    imageUrl: space.imageUrl,
  }));
}
