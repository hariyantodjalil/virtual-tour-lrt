import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
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
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const station = await prisma.station.update({ where: { id }, data: body });
  return NextResponse.json(station);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.station.delete({ where: { id } });
  return NextResponse.json({ message: "Stasiun dihapus" });
}
