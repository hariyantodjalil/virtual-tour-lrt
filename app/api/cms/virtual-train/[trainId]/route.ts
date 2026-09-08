import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortTrainScenesByTourOrder } from "@/lib/train-tour-structure";
import { Prisma } from "@prisma/client";
import { parseJsonRequest } from "@/lib/api-validation";
import { sceneCreateSchema, sceneOrderSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ trainId: string }> };

const sceneSelect = {
  id: true,
  trainId: true,
  sceneId: true,
  title: true,
  car: true,
  carId: true,
  zoneId: true,
  panoramaUrl: true,
  originalPanoramaUrl: true,
  thumbnailUrl: true,
  order: true,
  hotspots: true,
  canvasData: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const rawScenes = await prisma.trainTourScene.findMany({
    where: { trainId },
    orderBy: { order: "asc" },
    select: {
      ...sceneSelect,
      carRef: { select: { order: true } },
      zoneRef: { select: { order: true } },
    },
  });
  const scenes = sortTrainScenesByTourOrder(rawScenes).map((row) => {
    const { carRef, zoneRef, ...scene } = row;
    void carRef;
    void zoneRef;
    return scene;
  });
  return NextResponse.json(scenes);
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const parsed = await parseJsonRequest(request, sceneCreateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  let carId = body.levelId as string | undefined;
  const zoneId = body.areaId as string | undefined;
  let carSlug = body.level ?? "gerbong-1";

  if (zoneId) {
    const zone = await prisma.trainTourZone.findFirst({
      where: { id: zoneId, trainId },
      include: { car: true },
    });
    if (zone) {
      carId = zone.carId;
      carSlug = zone.car.slug;
    }
  }

  const scene = await prisma.trainTourScene.create({
    data: {
      trainId,
      sceneId: body.sceneId,
      title: body.title,
      car: carSlug,
      carId: carId ?? null,
      zoneId: zoneId ?? null,
      panoramaUrl: body.panoramaUrl || "",
      order: body.order ?? 0,
      hotspots: (body.hotspots ?? []) as Prisma.InputJsonValue,
      isActive: body.isActive ?? true,
    },
    select: sceneSelect,
  });

  return NextResponse.json(scene, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const parsed = await parseJsonRequest(request, sceneOrderSchema);
  if (!parsed.success) return parsed.response;
  const { orders } = parsed.data;

  await prisma.$transaction(
    orders.map(({ sceneId, order }) =>
      prisma.trainTourScene.update({
        where: { trainId_sceneId: { trainId, sceneId } },
        data: { order },
      })
    )
  );

  return NextResponse.json({ message: "Urutan diperbarui" });
}
