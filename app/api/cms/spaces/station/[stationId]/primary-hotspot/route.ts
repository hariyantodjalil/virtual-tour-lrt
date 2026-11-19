import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/api-validation";
import { requireRole } from "@/lib/auth";
import { normalizeHotspots } from "@/lib/hotspot-normalize";
import { primaryUnitHotspotSchema } from "@/lib/primary-unit-hotspot";
import { prisma } from "@/lib/prisma";
import { findUnitPinIndex, resolvePrimaryUnitHotspot } from "@/lib/space-hotspot-locate";
import { normalizeSpatialEntities } from "@/lib/spatial/normalize";

type Params = { params: Promise<{ stationId: string }> };
const updateSchema = z.object({
  spaceId: z.string().trim().min(1).max(128),
  target: primaryUnitHotspotSchema,
  selected: z.boolean(),
}).strict();

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, updateSchema, 4096);
  if (!parsed.success) return parsed.response;
  const { stationId } = await params;
  const { spaceId, target, selected } = parsed.data;
  const spaceWhere = { id: spaceId, stationId };

  if (!selected) {
    const result = await prisma.commercialSpace.updateMany({
      where: { ...spaceWhere, primaryHotspot: { equals: target } },
      data: { primaryHotspot: Prisma.DbNull },
    });
    if (!result.count) {
      const space = await prisma.commercialSpace.findFirst({ where: spaceWhere, select: { primaryHotspot: true } });
      if (!space) return NextResponse.json({ error: "Unit tidak ditemukan." }, { status: 404 });
      return NextResponse.json({ primaryHotspot: space.primaryHotspot });
    }
    return NextResponse.json({ primaryHotspot: null });
  }

  const result = await prisma.$transaction(async tx => {
    const space = await tx.commercialSpace.findFirst({ where: spaceWhere, select: { code: true } });
    if (!space) return "unit";

    // Menjaga penetapan ID pin lama konsisten dengan perubahan scene yang sedang disimpan editor lain.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM virtual_tour_scenes
      WHERE "stationId" = ${stationId} AND "sceneId" = ${target.sceneId} FOR UPDATE
    `;
    if (!rows.length) return "scene";
    const scene = await tx.virtualTourScene.findUnique({
      where: { id: rows[0].id },
      select: { id: true, sceneId: true, hotspots: true, publishedSpatialEntities: true, isActive: true, panoramaUrl: true },
    });
    if (!scene?.isActive || !scene.panoramaUrl) return "scene";

    const hotspots = normalizeHotspots(scene.hotspots);
    const placement = resolvePrimaryUnitHotspot({
      id: scene.sceneId,
      hotspots,
      spatialEntities: target.kind === "spatial"
        ? normalizeSpatialEntities(scene.publishedSpatialEntities, scene.sceneId)
        : undefined,
    }, space.code, target);
    if (!placement) return "hotspot";

    if (target.kind === "pin" && Array.isArray(scene.hotspots)) {
      const index = findUnitPinIndex(hotspots, space.code, target.hotspotId);
      const pin = scene.hotspots[index] as Prisma.JsonObject;
      if (pin.pinId !== target.hotspotId) {
        const savedHotspots = scene.hotspots.map((item, i) =>
          i === index ? { ...pin, pinId: target.hotspotId } : item);
        await tx.virtualTourScene.update({
          where: { id: scene.id },
          data: { hotspots: savedHotspots as Prisma.InputJsonArray },
        });
      }
    }

    await tx.commercialSpace.update({ where: spaceWhere, data: { primaryHotspot: target } });
    return "saved";
  });

  if (result === "unit") return NextResponse.json({ error: "Unit tidak ditemukan." }, { status: 404 });
  if (result === "scene") return NextResponse.json({ error: "Simpan dan aktifkan scene dengan panorama terlebih dahulu." }, { status: 409 });
  if (result === "hotspot") {
    const error = target.kind === "spatial"
      ? "Publikasikan area yang tertaut ke unit ini terlebih dahulu."
      : "Simpan pin yang tertaut ke unit ini terlebih dahulu.";
    return NextResponse.json({ error }, { status: 409 });
  }
  return NextResponse.json({ primaryHotspot: target });
}
