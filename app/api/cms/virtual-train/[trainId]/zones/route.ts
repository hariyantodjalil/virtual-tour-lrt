import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueTrainZoneSlug } from "@/lib/train-tour-structure";
import { slugifyLabel } from "@/lib/train-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";
import { areaCreateSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ trainId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { trainId } = await params;
  const parsed = await parseJsonRequest(request, areaCreateSchema);
  if (!parsed.success) return parsed.response;
  const { label, levelId: carId, slug: requestedSlug } = parsed.data;

  const car = await prisma.trainTourCar.findFirst({ where: { id: carId, trainId } });
  if (!car) return NextResponse.json({ error: "Gerbong tidak ditemukan" }, { status: 404 });

  const slug = requestedSlug ? slugifyLabel(requestedSlug) : await uniqueTrainZoneSlug(trainId, label);
  const maxOrder = await prisma.trainTourZone.aggregate({
    where: { trainId, carId },
    _max: { order: true },
  });

  const zone = await prisma.trainTourZone.create({
    data: {
      trainId,
      carId,
      slug,
      label,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(zone, { status: 201 });
}
