import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueLevelSlug } from "@/lib/virtual-tour-structure";
import { slugifyLabel } from "@/lib/virtual-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";
import { levelCreateSchema, levelOrderSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ stationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const levels = await prisma.virtualTourLevel.findMany({
    where: { stationId },
    orderBy: { order: "asc" },
    include: { areas: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(levels);
}

/** Bulk reorder: { orders: [{ levelId, order }] } */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const parsed = await parseJsonRequest(request, levelOrderSchema);
  if (!parsed.success) return parsed.response;
  const { orders } = parsed.data;

  await prisma.$transaction(
    orders.map((item) =>
      prisma.virtualTourLevel.updateMany({
        where: { id: item.levelId, stationId },
        data: { order: Number(item.order) },
      })
    )
  );

  const levels = await prisma.virtualTourLevel.findMany({
    where: { stationId },
    orderBy: { order: "asc" },
    include: { areas: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ message: "Urutan level diperbarui", levels });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const parsed = await parseJsonRequest(request, levelCreateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const { label } = body;

  const slug = body.slug ? slugifyLabel(String(body.slug)) : await uniqueLevelSlug(stationId, label);
  const maxOrder = await prisma.virtualTourLevel.aggregate({
    where: { stationId },
    _max: { order: true },
  });

  const level = await prisma.virtualTourLevel.create({
    data: {
      stationId,
      slug,
      label,
      color: body.color ?? "#10b981",
      hint: body.hint ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
      areas: {
        create: {
          stationId,
          slug: `${slug}-umum`,
          label: body.defaultAreaLabel ?? `${label} Umum`,
          order: 0,
        },
      },
    },
    include: { areas: true },
  });

  return NextResponse.json(level, { status: 201 });
}
