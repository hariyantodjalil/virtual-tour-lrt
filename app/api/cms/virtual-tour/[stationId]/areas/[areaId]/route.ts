import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyLabel } from "@/lib/virtual-tour-defaults";

type Params = { params: Promise<{ stationId: string; areaId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, areaId } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.label != null) data.label = String(body.label);
  if (body.order != null) data.order = Number(body.order);
  if (body.isActive != null) data.isActive = Boolean(body.isActive);
  if (body.slug != null) data.slug = slugifyLabel(String(body.slug));
  if (body.levelId != null) data.levelId = String(body.levelId);

  const area = await prisma.virtualTourArea.update({
    where: { id: areaId, stationId },
    data,
  });

  return NextResponse.json(area);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, areaId } = await params;

  const sceneCount = await prisma.virtualTourScene.count({ where: { stationId, areaId } });
  if (sceneCount > 0) {
    return NextResponse.json(
      { error: `Area masih punya ${sceneCount} scene. Pindahkan atau hapus scene dulu.` },
      { status: 400 }
    );
  }

  await prisma.virtualTourArea.delete({ where: { id: areaId, stationId } });
  return NextResponse.json({ message: "Area dihapus" });
}
