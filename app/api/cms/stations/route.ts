import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const stations = await prisma.station.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { commercialSpaces: true, virtualTourScenes: true } } },
  });
  return NextResponse.json(stations);
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const station = await prisma.station.create({ data: body });
  return NextResponse.json(station, { status: 201 });
}
