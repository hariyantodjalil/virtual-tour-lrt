import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyLabel } from "@/lib/train-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";
import { areaUpdateSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ trainId: string; zoneId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId, zoneId } = await params;
  const parsed = await parseJsonRequest(request, areaUpdateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  if (body.levelId) {
    const targetCar = await prisma.trainTourCar.findFirst({
      where: { id: body.levelId, trainId },
      select: { id: true },
    });
    if (!targetCar) {
      return NextResponse.json({ error: "Gerbong tujuan tidak ditemukan" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (body.label != null) data.label = body.label;
  if (body.order != null) data.order = body.order;
  if (body.isActive != null) data.isActive = body.isActive;
  if (body.slug != null) data.slug = slugifyLabel(body.slug);
  if (body.levelId != null) data.carId = body.levelId;

  const zone = await prisma.trainTourZone.update({
    where: { id: zoneId, trainId },
    data,
  });

  return NextResponse.json(zone);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId, zoneId } = await params;

  const sceneCount = await prisma.trainTourScene.count({ where: { trainId, zoneId } });
  if (sceneCount > 0) {
    return NextResponse.json(
      { error: `Zona masih punya ${sceneCount} scene. Pindahkan atau hapus scene dulu.` },
      { status: 400 }
    );
  }

  await prisma.trainTourZone.delete({ where: { id: zoneId, trainId } });
  return NextResponse.json({ message: "Zona dihapus" });
}
