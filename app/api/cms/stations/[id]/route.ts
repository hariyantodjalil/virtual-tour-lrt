import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { stationUpdateSchema } from "@/lib/api-schemas";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const station = await prisma.station.findUnique({
    where: { id },
    include: { commercialSpaces: true, virtualTourScenes: { orderBy: { order: "asc" } } },
  });
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan" }, { status: 404 });
  return NextResponse.json(station);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = await parseJsonRequest(request, stationUpdateSchema);
  if (!parsed.success) return parsed.response;
  const station = await prisma.station.update({ where: { id }, data: parsed.data });
  return NextResponse.json(station);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.station.delete({ where: { id } });
  return NextResponse.json({ message: "Stasiun dihapus" });
}
