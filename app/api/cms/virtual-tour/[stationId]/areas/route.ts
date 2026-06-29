import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueAreaSlug } from "@/lib/virtual-tour-structure";
import { slugifyLabel } from "@/lib/virtual-tour-defaults";

type Params = { params: Promise<{ stationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const body = await request.json();
  const label = String(body.label ?? "").trim();
  const levelId = String(body.levelId ?? "");
  if (!label || !levelId) {
    return NextResponse.json({ error: "label dan levelId wajib" }, { status: 400 });
  }

  const level = await prisma.virtualTourLevel.findFirst({ where: { id: levelId, stationId } });
  if (!level) return NextResponse.json({ error: "Level tidak ditemukan" }, { status: 404 });

  const slug = body.slug ? slugifyLabel(String(body.slug)) : await uniqueAreaSlug(stationId, label);
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
