import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortScenesByTourOrder } from "@/lib/virtual-tour-structure";

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
  thumbnailUrl: true,
  order: true,
  hotspots: true,
  canvasData: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
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
  const scenes = sortScenesByTourOrder(rawScenes).map(({ levelRef: _l, areaRef: _a, ...scene }) => scene);
  return NextResponse.json(scenes);
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const body = await request.json();

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
      hotspots: body.hotspots ?? [],
      isActive: body.isActive ?? true,
    },
    select: sceneSelect,
  });

  return NextResponse.json(scene, { status: 201 });
}

// PATCH — batch update urutan scene (reorder)
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const body = await request.json(); // { orders: [{ sceneId, order }] }

  if (!Array.isArray(body.orders)) {
    return NextResponse.json({ error: "orders harus array" }, { status: 400 });
  }

  await prisma.$transaction(
    body.orders.map(({ sceneId, order }: { sceneId: string; order: number }) =>
      prisma.virtualTourScene.update({
        where: { stationId_sceneId: { stationId, sceneId } },
        data: { order },
      })
    )
  );

  return NextResponse.json({ message: "Urutan diperbarui" });
}
