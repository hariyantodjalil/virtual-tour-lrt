import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { stationCreateSchema } from "@/lib/api-schemas";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const stations = await prisma.station.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { commercialSpaces: true, virtualTourScenes: true } } },
  });
  return NextResponse.json(stations);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, stationCreateSchema);
  if (!parsed.success) return parsed.response;
  const station = await prisma.station.create({ data: parsed.data });
  return NextResponse.json(station, { status: 201 });
}
