import type { Prisma } from "@prisma/client";

/**
 * Keterhubungan unit tenant dengan penanda lokasi di panorama.
 * Hotspot pin menaut lewat `spaceCode` (kode unit stasiun / nomor tampilan train space);
 * Spatial Area stasiun menaut lewat `unitId` (otoritatif) dan `spaceCode`.
 */

export type HotspotLink = {
  sceneId: string;
  title: string;
  hotspots: number;
  spatialAreas: number;
};

type JsonRecord = Record<string, unknown>;

function asList(value: Prisma.JsonValue | null | undefined): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(
    (item): item is JsonRecord => !!item && typeof item === "object" && !Array.isArray(item)
  );
}

function isUnitHotspot(hotspot: JsonRecord, code: string) {
  return (hotspot.type === "space" || hotspot.type === "ad" || hotspot.type === undefined) && hotspot.spaceCode === code;
}

function isUnitSpatial(entity: JsonRecord, unit: { id: string; code: string }) {
  return entity.unitId === unit.id || entity.spaceCode === unit.code;
}

/** Hotspot pin tanpa spaceCode unit ini; untuk hotspot ad, cukup lepas tautan unit agar materi iklan tidak hilang. */
function withoutUnitHotspots(list: JsonRecord[], code: string) {
  return list.flatMap((hotspot) => {
    if (!isUnitHotspot(hotspot, code)) return [hotspot];
    if (hotspot.type === "ad") {
      const rest = { ...hotspot };
      delete rest.spaceCode;
      return [rest];
    }
    return [];
  });
}

export function countLinks(links: HotspotLink[]) {
  return links.reduce((total, link) => total + link.hotspots + link.spatialAreas, 0);
}

export function describeLinks(links: HotspotLink[]) {
  return links.map((link) => link.title || link.sceneId).join(", ");
}

// ─── Unit stasiun ─────────────────────────────────────────────────────────────

async function stationScenes(tx: Prisma.TransactionClient, stationId: string) {
  return tx.virtualTourScene.findMany({
    where: { stationId },
    select: {
      id: true,
      sceneId: true,
      title: true,
      hotspots: true,
      spatialEntities: true,
      publishedSpatialEntities: true,
    },
  });
}

export async function findStationSpaceLinks(
  tx: Prisma.TransactionClient,
  stationId: string,
  unit: { id: string; code: string }
): Promise<HotspotLink[]> {
  const scenes = await stationScenes(tx, stationId);
  return scenes.flatMap((scene) => {
    const hotspots = asList(scene.hotspots).filter((h) => isUnitHotspot(h, unit.code)).length;
    const spatialIds = new Set(
      [...asList(scene.spatialEntities), ...asList(scene.publishedSpatialEntities)]
        .filter((entity) => isUnitSpatial(entity, unit))
        .map((entity) => String(entity.id ?? ""))
    );
    const spatialAreas = spatialIds.size;
    return hotspots + spatialAreas > 0 ? [{ sceneId: scene.sceneId, title: scene.title, hotspots, spatialAreas }] : [];
  });
}

/** Hapus semua penanda yang menaut ke unit. Mengembalikan jumlah penanda yang dihapus/dilepas. */
export async function removeStationSpaceLinks(
  tx: Prisma.TransactionClient,
  stationId: string,
  unit: { id: string; code: string }
) {
  const scenes = await stationScenes(tx, stationId);
  let affected = 0;
  for (const scene of scenes) {
    const hotspots = asList(scene.hotspots);
    const draft = asList(scene.spatialEntities);
    const published = asList(scene.publishedSpatialEntities);
    const nextHotspots = withoutUnitHotspots(hotspots, unit.code);
    const nextDraft = draft.filter((entity) => !isUnitSpatial(entity, unit));
    const nextPublished = published.filter((entity) => !isUnitSpatial(entity, unit));
    const hotspotChanges = hotspots.filter((h) => isUnitHotspot(h, unit.code)).length;
    const spatialChanged = nextDraft.length !== draft.length || nextPublished.length !== published.length;
    if (hotspotChanges === 0 && !spatialChanged) continue;

    affected += hotspotChanges + (draft.length - nextDraft.length) + (published.length - nextPublished.length);
    await tx.virtualTourScene.update({
      where: { id: scene.id },
      data: {
        hotspots: nextHotspots as Prisma.InputJsonValue,
        ...(spatialChanged
          ? {
              spatialEntities: nextDraft as Prisma.InputJsonValue,
              publishedSpatialEntities: nextPublished as Prisma.InputJsonValue,
              // Editor yang masih memegang revisi lama harus memuat ulang sebelum menyimpan.
              spatialRevision: { increment: 1 },
            }
          : {}),
      },
    });
  }
  return affected;
}

/** Ikuti perubahan kode unit ke semua penanda agar tautan tidak putus. */
export async function renameStationSpaceCode(
  tx: Prisma.TransactionClient,
  stationId: string,
  unit: { id: string; oldCode: string; newCode: string }
) {
  const scenes = await stationScenes(tx, stationId);
  const match = { id: unit.id, code: unit.oldCode };
  let affected = 0;
  for (const scene of scenes) {
    let changed = 0;
    let spatialChanged = false;
    const nextHotspots = asList(scene.hotspots).map((hotspot) => {
      if (!isUnitHotspot(hotspot, unit.oldCode)) return hotspot;
      changed += 1;
      return { ...hotspot, spaceCode: unit.newCode };
    });
    const renameSpatial = (list: JsonRecord[]) =>
      list.map((entity) => {
        if (!isUnitSpatial(entity, match) || entity.spaceCode === unit.newCode) return entity;
        spatialChanged = true;
        changed += 1;
        return { ...entity, spaceCode: unit.newCode };
      });
    const nextDraft = renameSpatial(asList(scene.spatialEntities));
    const nextPublished = renameSpatial(asList(scene.publishedSpatialEntities));
    if (changed === 0) continue;

    affected += changed;
    await tx.virtualTourScene.update({
      where: { id: scene.id },
      data: {
        hotspots: nextHotspots as Prisma.InputJsonValue,
        ...(spatialChanged
          ? {
              spatialEntities: nextDraft as Prisma.InputJsonValue,
              publishedSpatialEntities: nextPublished as Prisma.InputJsonValue,
              spatialRevision: { increment: 1 },
            }
          : {}),
      },
    });
  }
  return affected;
}

// ─── Train space ──────────────────────────────────────────────────────────────

async function trainScenes(tx: Prisma.TransactionClient, trainId: string) {
  return tx.trainTourScene.findMany({
    where: { trainId },
    select: { id: true, sceneId: true, title: true, hotspots: true },
  });
}

export async function findTrainSpaceLinks(
  tx: Prisma.TransactionClient,
  trainId: string,
  displayNumber: string
): Promise<HotspotLink[]> {
  const scenes = await trainScenes(tx, trainId);
  return scenes.flatMap((scene) => {
    const hotspots = asList(scene.hotspots).filter((h) => isUnitHotspot(h, displayNumber)).length;
    return hotspots > 0 ? [{ sceneId: scene.sceneId, title: scene.title, hotspots, spatialAreas: 0 }] : [];
  });
}

export async function removeTrainSpaceLinks(tx: Prisma.TransactionClient, trainId: string, displayNumber: string) {
  const scenes = await trainScenes(tx, trainId);
  let affected = 0;
  for (const scene of scenes) {
    const hotspots = asList(scene.hotspots);
    const count = hotspots.filter((h) => isUnitHotspot(h, displayNumber)).length;
    if (count === 0) continue;
    affected += count;
    await tx.trainTourScene.update({
      where: { id: scene.id },
      data: { hotspots: withoutUnitHotspots(hotspots, displayNumber) as Prisma.InputJsonValue },
    });
  }
  return affected;
}

export async function renameTrainSpaceCode(
  tx: Prisma.TransactionClient,
  trainId: string,
  oldCode: string,
  newCode: string
) {
  const scenes = await trainScenes(tx, trainId);
  let affected = 0;
  for (const scene of scenes) {
    let changed = 0;
    const next = asList(scene.hotspots).map((hotspot) => {
      if (!isUnitHotspot(hotspot, oldCode)) return hotspot;
      changed += 1;
      return { ...hotspot, spaceCode: newCode };
    });
    if (changed === 0) continue;
    affected += changed;
    await tx.trainTourScene.update({
      where: { id: scene.id },
      data: { hotspots: next as Prisma.InputJsonValue },
    });
  }
  return affected;
}
