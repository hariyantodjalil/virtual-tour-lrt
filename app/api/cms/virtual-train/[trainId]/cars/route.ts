import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueTrainCarSlug } from "@/lib/train-tour-structure";
import { slugifyLabel } from "@/lib/train-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";
import { levelCreateSchema, levelOrderSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ trainId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const cars = await prisma.trainTourCar.findMany({
    where: { trainId },
    orderBy: { order: "asc" },
    include: { zones: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(cars);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const parsed = await parseJsonRequest(request, levelOrderSchema);
  if (!parsed.success) return parsed.response;
  const { orders } = parsed.data;

  await prisma.$transaction(
    orders.map((item) =>
      prisma.trainTourCar.updateMany({
        where: { id: item.levelId, trainId },
        data: { order: Number(item.order) },
      })
    )
  );

  const cars = await prisma.trainTourCar.findMany({
    where: { trainId },
    orderBy: { order: "asc" },
    include: { zones: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ message: "Urutan gerbong diperbarui", cars });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const parsed = await parseJsonRequest(request, levelCreateSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const { label } = body;

  const slug = body.slug ? slugifyLabel(String(body.slug)) : await uniqueTrainCarSlug(trainId, label);
  const maxOrder = await prisma.trainTourCar.aggregate({
    where: { trainId },
    _max: { order: true },
  });

  const car = await prisma.trainTourCar.create({
    data: {
      trainId,
      slug,
      label,
      color: body.color ?? "#3b82f6",
      hint: body.hint ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
      zones: {
        create: {
          trainId,
          slug: `${slug}-utama`,
          label: body.defaultAreaLabel ?? `${label} Utama`,
          order: 0,
        },
      },
    },
    include: { zones: true },
  });

  return NextResponse.json(car, { status: 201 });
}
