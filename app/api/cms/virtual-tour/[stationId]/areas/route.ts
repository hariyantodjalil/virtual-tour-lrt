import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueAreaSlug } from "@/lib/virtual-tour-structure";
import { slugifyLabel } from "@/lib/virtual-tour-defaults";
import { parseJsonRequest } from "@/lib/api-validation";
import { areaCreateSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ stationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const parsed = await parseJsonRequest(request, areaCreateSchema);
  if (!parsed.success) return parsed.response;
  const { label, levelId, slug: requestedSlug } = parsed.data;

  const level = await prisma.virtualTourLevel.findFirst({ where: { id: levelId, stationId } });
  if (!level) return NextResponse.json({ error: "Level tidak ditemukan" }, { status: 404 });

  const slug = requestedSlug ? slugifyLabel(requestedSlug) : await uniqueAreaSlug(stationId, label);
  const maxOrder = await prisma.virtualTourArea.aggregate({
    where: { stationId, levelId },
    _max: { order: true },
  });

  const area = await prisma.virtualTourArea.create({
    data: {
      stationId,
      levelId,
      slug,
      label,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(area, { status: 201 });
}
