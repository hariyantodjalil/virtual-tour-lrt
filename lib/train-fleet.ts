import { prisma } from "@/lib/prisma";
import type { TrainFleet } from "@/lib/train-fleet-shared";

export async function getTrainFleet(trainId: string, includeInactive = false): Promise<TrainFleet> {
  const [cars, trainsets, train] = await Promise.all([
    prisma.trainTourCar.findMany({ where: { trainId, ...(!includeInactive && { isActive: true }) }, orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true, slug: true, label: true, order: true, isActive: true } }),
    prisma.trainset.findMany({ where: { trainId, ...(!includeInactive && { isActive: true }) }, orderBy: [{ order: "asc" }, { code: "asc" }], select: { id: true, code: true, order: true, isActive: true } }),
    prisma.train.findUnique({ where: { id: trainId }, select: { advertisingCapacity: true } }),
  ]);
  return { trainId, cars, trainsets, advertisingCapacity: train?.advertisingCapacity ?? null };
}
