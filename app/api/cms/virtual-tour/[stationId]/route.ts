import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ stationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const scenes = await prisma.virtualTourScene.findMany({
    where: { stationId },
    orderBy: { order: "asc" },
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
      panoramaUrl: body.panoramaUrl || "",
      order: body.order ?? 0,
      hotspots: body.hotspots ?? [],
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json(scene, { status: 201 });
}
