import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyLabel } from "@/lib/train-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";
import { levelUpdateSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ trainId: string; carId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId, carId } = await params;
  const parsed = await parseJsonRequest(request, levelUpdateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const data: Record<string, unknown> = {};
  if (body.label != null) data.label = body.label;
  if (body.color != null) data.color = body.color;
  if (body.hint !== undefined) data.hint = body.hint || null;
  if (body.order != null) data.order = body.order;
  if (body.isActive != null) data.isActive = body.isActive;
  if (body.slug != null) data.slug = slugifyLabel(body.slug);

  const car = await prisma.trainTourCar.update({
    where: { id: carId, trainId },
    data,
    include: { zones: { orderBy: { order: "asc" } } },
  });

  if (data.slug) {
    await prisma.trainTourScene.updateMany({
      where: { trainId, carId },
      data: { car: String(data.slug) },
    });
  }

  return NextResponse.json(car);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId, carId } = await params;

  const sceneCount = await prisma.trainTourScene.count({ where: { trainId, carId } });
  if (sceneCount > 0) {
    return NextResponse.json(
      { error: `Gerbong masih punya ${sceneCount} scene. Pindahkan atau hapus scene dulu.` },
      { status: 400 }
    );
  }

  await prisma.trainTourCar.delete({ where: { id: carId, trainId } });
  return NextResponse.json({ message: "Gerbong dihapus" });
}
