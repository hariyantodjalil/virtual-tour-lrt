import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortScenesByTourOrder } from "@/lib/virtual-tour-structure";
import { Prisma } from "@prisma/client";
import { parseJsonRequest } from "@/lib/api-validation";
import { sceneCreateSchema, sceneOrderSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ stationId: string }> };

const sceneSelect = {
  id: true,
  stationId: true,
  sceneId: true,
  title: true,
  level: true,
  levelId: true,
  areaId: true,
  panoramaUrl: true,
  originalPanoramaUrl: true,
  thumbnailUrl: true,
  order: true,
  hotspots: true,
  canvasData: true,
  spatialEntities: true,
  spatialRevision: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const rawScenes = await prisma.virtualTourScene.findMany({
    where: { stationId },
    orderBy: { order: "asc" },
    select: {
      ...sceneSelect,
      levelRef: { select: { order: true } },
      areaRef: { select: { order: true } },
    },
  });
  const scenes = sortScenesByTourOrder(rawScenes).map((row) => {
    const { levelRef, areaRef, ...scene } = row;
    void levelRef;
    void areaRef;
    return scene;
  });
  return NextResponse.json(scenes, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const parsed = await parseJsonRequest(request, sceneCreateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  let levelId = body.levelId as string | undefined;
  const areaId = body.areaId as string | undefined;
  let levelSlug = body.level ?? "concourse";

  if (areaId) {
    const area = await prisma.virtualTourArea.findFirst({
      where: { id: areaId, stationId },
      include: { level: true },
    });
    if (area) {
      levelId = area.levelId;
      levelSlug = area.level.slug;
    }
  }

  const scene = await prisma.virtualTourScene.create({
    data: {
      stationId,
      sceneId: body.sceneId,
      title: body.title,
      level: levelSlug,
      levelId: levelId ?? null,
      areaId: areaId ?? null,
      panoramaUrl: body.panoramaUrl || "",
      order: body.order ?? 0,
      hotspots: (body.hotspots ?? []) as Prisma.InputJsonValue,
      isActive: body.isActive ?? true,
    },
    select: sceneSelect,
  });

  return NextResponse.json(scene, { status: 201 });
}

// PATCH — batch update urutan scene (reorder)
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const parsed = await parseJsonRequest(request, sceneOrderSchema);
  if (!parsed.success) return parsed.response;
  const { orders } = parsed.data;

  await prisma.$transaction(
    orders.map(({ sceneId, order }) =>
      prisma.virtualTourScene.update({
        where: { stationId_sceneId: { stationId, sceneId } },
        data: { order },
      })
    )
  );

  return NextResponse.json({ message: "Urutan diperbarui" });
}
