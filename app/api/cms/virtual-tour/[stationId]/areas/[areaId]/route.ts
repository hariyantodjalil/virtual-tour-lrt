import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyLabel } from "@/lib/virtual-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";
import { areaUpdateSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ stationId: string; areaId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, areaId } = await params;
  const parsed = await parseJsonRequest(request, areaUpdateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  if (body.levelId) {
    const targetLevel = await prisma.virtualTourLevel.findFirst({
      where: { id: body.levelId, stationId },
      select: { id: true },
    });
    if (!targetLevel) {
      return NextResponse.json({ error: "Level tujuan tidak ditemukan di stasiun ini" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (body.label != null) data.label = body.label;
  if (body.order != null) data.order = body.order;
  if (body.isActive != null) data.isActive = body.isActive;
  if (body.slug != null) data.slug = slugifyLabel(body.slug);
  if (body.levelId != null) data.levelId = body.levelId;

  const area = await prisma.virtualTourArea.update({
    where: { id: areaId, stationId },
    data,
  });

  return NextResponse.json(area);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
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
