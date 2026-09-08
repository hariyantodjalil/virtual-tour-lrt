import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrainTourStructure, sortTrainScenesByTourOrder } from "@/lib/train-tour-structure";

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

  try {
    const structure = await getTrainTourStructure(trainId);
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

    return NextResponse.json({ ...structure, scenes });
  } catch (err) {
    console.error("[train structure GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat struktur tur kereta" },
      { status: 500 }
    );
  }
}
