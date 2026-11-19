import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/api-validation";
import { requireRole } from "@/lib/auth";
import { normalizeHotspots } from "@/lib/hotspot-normalize";
import { prisma } from "@/lib/prisma";
import { sceneEntryViewSchema } from "@/lib/scene-entry-view";

import { lockTourSceneLinks, type TourScope } from "@/lib/tour-scene-links";
const schema = z.object({
  sourceId: z.string().min(1).max(128),
  destinationId: z.string().min(1).max(128),
  index: z.number().int().min(0).max(199),
  yaw: z.number().finite(),
  pitch: z.number().finite(),
  previousView: sceneEntryViewSchema.nullable(),
  view: sceneEntryViewSchema.nullable(),
}).strict();

export async function saveArrivalView(request: NextRequest, scope: TourScope) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, schema, 4096);
  if (!parsed.success) return parsed.response;
  const { sourceId, destinationId, index, yaw, pitch, view, previousView } = parsed.data;

  const saved = await prisma.$transaction(async tx => {
    await lockTourSceneLinks(tx, scope);
    const locked = "stationId" in scope
      ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM virtual_tour_scenes WHERE "stationId" = ${scope.stationId} AND "sceneId" = ${sourceId} FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM train_tour_scenes WHERE "trainId" = ${scope.trainId} AND "sceneId" = ${sourceId} FOR UPDATE`;
    if (!locked.length) return null;
    const where = { id: locked[0].id };
    const select = { hotspots: true } as const;
    const scene = "stationId" in scope
      ? await tx.virtualTourScene.findUnique({ where, select })
      : await tx.trainTourScene.findUnique({ where, select });
    if (!Array.isArray(scene?.hotspots)) return null;
    const hotspot = normalizeHotspots(scene.hotspots)[index];
    if (hotspot?.type !== "scene" || hotspot.sceneId !== destinationId ||
      hotspot.yaw !== yaw || hotspot.pitch !== pitch) return null;
    if (JSON.stringify(hotspot.targetView ?? null) !== JSON.stringify(previousView)) return null;

    const raw = { ...scene.hotspots[index] as Prisma.JsonObject };
    if (view) raw.targetView = view;
    else delete raw.targetView;
    const hotspots = scene.hotspots.map((item, i) => i === index ? raw : item);
    const update = { where, data: { hotspots: hotspots as Prisma.InputJsonArray }, select };
    return "stationId" in scope
      ? tx.virtualTourScene.update(update)
      : tx.trainTourScene.update(update);
  });

  if (!saved) {
    return NextResponse.json({ error: "Koneksi sudah berubah. Muat ulang editor sebelum mengatur arah tiba." }, { status: 409 });
  }
  return NextResponse.json(saved);
}
