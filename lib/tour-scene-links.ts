import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeHotspots } from "@/lib/hotspot-normalize";

export type TourScope = { stationId: string } | { trainId: string };

export async function lockTourSceneLinks(tx: Prisma.TransactionClient, scope: TourScope) {
  if ("stationId" in scope) {
    await tx.$queryRaw`SELECT id FROM stations WHERE id = ${scope.stationId} FOR NO KEY UPDATE`;
  } else {
    await tx.$queryRaw`SELECT id FROM trains WHERE id = ${scope.trainId} FOR NO KEY UPDATE`;
  }
}

function sceneLinkTarget(item: unknown): string | undefined {
  if (!item || typeof item !== "object" || !("sceneId" in item) || !item.sceneId) return;
  const hotspot = normalizeHotspots([item])[0];
  return hotspot.type === "scene" ? hotspot.sceneId : undefined;
}

export async function validSceneHotspots(
  tx: Prisma.TransactionClient, scope: TourScope, hotspots: unknown[], creatingSceneId?: string
): Promise<Prisma.InputJsonValue> {
  const select = { sceneId: true } as const;
  const scenes = "stationId" in scope
    ? await tx.virtualTourScene.findMany({ where: scope, select })
    : await tx.trainTourScene.findMany({ where: scope, select });
  const valid = new Set(scenes.map(scene => scene.sceneId));
  if (creatingSceneId) valid.add(creatingSceneId);
  return hotspots.filter(item => {
    const target = sceneLinkTarget(item);
    return !target || valid.has(target);
  }) as Prisma.InputJsonArray;
}

export async function deleteSceneAndLinks(scope: TourScope, sceneId: string) {
  return prisma.$transaction(async tx => {
    await lockTourSceneLinks(tx, scope);
    const deleted = "stationId" in scope
      ? await tx.virtualTourScene.deleteMany({ where: { ...scope, sceneId } })
      : await tx.trainTourScene.deleteMany({ where: { ...scope, sceneId } });
    if (!deleted.count) return false;

    const select = { id: true, hotspots: true } as const;
    const scenes = "stationId" in scope
      ? await tx.virtualTourScene.findMany({ where: scope, select })
      : await tx.trainTourScene.findMany({ where: scope, select });
    for (const scene of scenes) {
      if (!Array.isArray(scene.hotspots)) continue;
      const hotspots = scene.hotspots.filter(item => sceneLinkTarget(item) !== sceneId);
      if (hotspots.length === scene.hotspots.length) continue;
      const update = { where: { id: scene.id }, data: { hotspots: hotspots as Prisma.InputJsonArray } };
      if ("stationId" in scope) await tx.virtualTourScene.update(update);
      else await tx.trainTourScene.update(update);
    }
    return true;
  });
}
