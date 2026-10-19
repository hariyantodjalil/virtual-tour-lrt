import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTourStructure, sortScenesByTourOrder } from "@/lib/virtual-tour-structure";

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

  try {
    const structure = await getTourStructure(stationId);
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

    return NextResponse.json(
      { ...structure, scenes },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("[structure GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat struktur tur" },
      { status: 500 }
    );
  }
}
