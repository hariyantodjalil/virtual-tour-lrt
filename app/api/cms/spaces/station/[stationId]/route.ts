import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ stationId: string }> };

function spacePayload(body: Record<string, unknown>) {
  return {
    code: String(body.code ?? "").trim(),
    name: String(body.name ?? "").trim(),
    type: body.type as never,
    status: body.status as never,
    area: Number(body.area ?? 0),
    monthlyRent: Number(body.monthlyRent ?? 0),
    deposit: Number(body.deposit ?? 0),
    floor: String(body.floor ?? "G").trim(),
    location: String(body.location ?? "").trim(),
    nearestExit: body.nearestExit ? String(body.nearestExit).trim() : null,
    exposure: Number(body.exposure ?? 0),
    powerSupply: body.powerSupply ? String(body.powerSupply).trim() : null,
    waterAccess: Boolean(body.waterAccess),
    airConditioning: Boolean(body.airConditioning),
    description: body.description ? String(body.description).trim() : null,
    panoramaUrl: body.panoramaUrl ? String(body.panoramaUrl).trim() : null,
  };
}

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
    data: { ...spacePayload(body), stationId },
  });
  return NextResponse.json(space, { status: 201 });
}
