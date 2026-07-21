import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** Assign / ganti unit yang diisi tenant. */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: tenantId } = await params;
  const body = await request.json();
  const { spaceId, startDate, endDate } = body as {
    spaceId?: string;
    startDate?: string | null;
    endDate?: string | null;
  };

  if (!spaceId) return NextResponse.json({ error: "spaceId wajib" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 });

  const space = await prisma.commercialSpace.findFirst({
    where: { id: spaceId, stationId: tenant.stationId },
  });
  if (!space) return NextResponse.json({ error: "Unit tidak ditemukan di stasiun ini" }, { status: 404 });

  const occupancy = await prisma.$transaction(async (tx) => {
    const row = await tx.spaceOccupancy.upsert({
      where: { spaceId },
      create: {
        spaceId,
        tenantId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      update: {
        tenantId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: {
        space: { select: { id: true, code: true, name: true, type: true, status: true } },
      },
    });

    await tx.commercialSpace.update({
      where: { id: spaceId },
      data: { status: "TERISI" },
    });

    return row;
  });

  return NextResponse.json(occupancy);
}

/** Lepas occupancy unit dari tenant. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: tenantId } = await params;
  const spaceId = request.nextUrl.searchParams.get("spaceId");
  if (!spaceId) return NextResponse.json({ error: "spaceId wajib" }, { status: 400 });

  const occupancy = await prisma.spaceOccupancy.findFirst({
    where: { tenantId, spaceId },
  });
  if (!occupancy) return NextResponse.json({ error: "Occupancy tidak ditemukan" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.spaceOccupancy.delete({ where: { id: occupancy.id } });
    await tx.commercialSpace.update({
      where: { id: spaceId },
      data: { status: "TERSEDIA" },
    });
  });

  return NextResponse.json({ message: "Occupancy dihapus" });
}
