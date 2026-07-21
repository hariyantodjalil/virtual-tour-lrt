import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueLevelSlug } from "@/lib/virtual-tour-structure";
import { slugifyLabel } from "@/lib/virtual-tour-defaults";

type Params = { params: Promise<{ stationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
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
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const body = await request.json();
  const orders = body.orders as { levelId: string; order: number }[] | undefined;

  if (!Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: "orders harus array" }, { status: 400 });
  }

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
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const body = await request.json();
  const label = String(body.label ?? "").trim();
  if (!label) return NextResponse.json({ error: "Label wajib diisi" }, { status: 400 });

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
