import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ stationId: string }> };

const sceneSelect = {
  id: true,
  stationId: true,
  sceneId: true,
  title: true,
  level: true,
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
  const scenes = await prisma.virtualTourScene.findMany({
    where: { stationId },
    orderBy: { order: "asc" },
    select: sceneSelect,
  });
  return NextResponse.json(scenes);
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const body = await request.json();

  const scene = await prisma.virtualTourScene.create({
    data: {
      stationId,
      sceneId: body.sceneId,
      title: body.title,
      level: body.level ?? "CONCOURSE",
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
