import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ stationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const spaces = await prisma.commercialSpace.findMany({
    where: { stationId },
    orderBy: [{ floor: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(spaces);
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { stationId } = await params;
  const body = await request.json();
  const space = await prisma.commercialSpace.create({
    data: { ...body, stationId },
  });
  return NextResponse.json(space, { status: 201 });
}
