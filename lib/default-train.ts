import { prisma } from "@/lib/prisma";
import { ensureTrainTourStructure } from "@/lib/train-tour-structure";

import { DEFAULT_TRAIN_SLUG, DEFAULT_TRAIN_NAME } from "@/lib/train-constants";
export async function ensureDefaultTrain() {
  let train = await prisma.train.findUnique({
    where: { slug: DEFAULT_TRAIN_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!train) {
    train = await prisma.train.create({
      data: {
        name: DEFAULT_TRAIN_NAME,
        slug: DEFAULT_TRAIN_SLUG,
        formation: "6 gerbong",
        order: 0,
        virtualTour: { create: {} },
      },
      select: { id: true, name: true, slug: true },
    });
  }

  await ensureTrainTourStructure(train.id);
  return train;
}

export async function getDefaultTrainId() {
  const train = await ensureDefaultTrain();
  return train.id;
}
