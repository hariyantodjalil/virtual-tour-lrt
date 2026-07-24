import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { tenantCreateSchema } from "@/lib/api-schemas";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const stationId = request.nextUrl.searchParams.get("stationId");

  const tenants = await prisma.tenant.findMany({
    where: stationId ? { stationId } : undefined,
    include: {
      station: { select: { id: true, name: true, slug: true } },
      occupancies: {
        include: {
          space: { select: { id: true, code: true, name: true, type: true, status: true } },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { brandName: "asc" }],
  });

  return NextResponse.json(tenants);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, tenantCreateSchema);
  if (!parsed.success) return parsed.response;
  const { stationId, brandName, contactName, phone, email, notes, spaceId, startDate, endDate } = parsed.data;

  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) return NextResponse.json({ error: "Stasiun tidak ditemukan" }, { status: 404 });

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        stationId,
        brandName,
        contactName: contactName || null,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
      },
    });

    if (spaceId) {
      const space = await tx.commercialSpace.findFirst({
        where: { id: spaceId, stationId },
      });
      if (!space) throw new Error("SPACE_NOT_FOUND");

      await tx.spaceOccupancy.upsert({
        where: { spaceId },
        create: {
          spaceId,
          tenantId: created.id,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        },
        update: {
          tenantId: created.id,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
        },
      });

      await tx.commercialSpace.update({
        where: { id: spaceId },
        data: { status: "TERISI" },
      });
    }

    return tx.tenant.findUnique({
      where: { id: created.id },
      include: {
        station: { select: { id: true, name: true, slug: true } },
        occupancies: {
          include: {
            space: { select: { id: true, code: true, name: true, type: true, status: true } },
          },
        },
      },
    });
  });

  return NextResponse.json(tenant, { status: 201 });
}
