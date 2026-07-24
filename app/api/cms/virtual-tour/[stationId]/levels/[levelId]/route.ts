import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyLabel } from "@/lib/virtual-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";
import { levelUpdateSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ stationId: string; levelId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, levelId } = await params;
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

  const level = await prisma.virtualTourLevel.update({
    where: { id: levelId, stationId },
    data,
    include: { areas: { orderBy: { order: "asc" } } },
  });

  if (data.slug) {
    await prisma.virtualTourScene.updateMany({
      where: { stationId, levelId },
      data: { level: String(data.slug) },
    });
  }

  return NextResponse.json(level);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId, levelId } = await params;

  const sceneCount = await prisma.virtualTourScene.count({ where: { stationId, levelId } });
  if (sceneCount > 0) {
    return NextResponse.json(
      { error: `Level masih punya ${sceneCount} scene. Pindahkan atau hapus scene dulu.` },
      { status: 400 }
    );
  }

  await prisma.virtualTourLevel.delete({ where: { id: levelId, stationId } });
  return NextResponse.json({ message: "Level dihapus" });
}
