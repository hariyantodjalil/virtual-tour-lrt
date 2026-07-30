import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { leadUpdateSchema } from "@/lib/api-schemas";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const leads = await prisma.tenantLead.findMany({
    orderBy: { createdAt: "desc" },
    include: { space: { include: { station: true } } },
  });
  return NextResponse.json(leads);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, leadUpdateSchema);
  if (!parsed.success) return parsed.response;
  const { id, status, notes, followUpAt } = parsed.data;

  const existing = await prisma.tenantLead.findUnique({
    where: { id },
    include: {
      space: { select: { id: true, stationId: true, status: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Lead tidak ditemukan" }, { status: 404 });
  }

  const lead = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenantLead.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(followUpAt !== undefined && {
          followUpAt: followUpAt ? new Date(followUpAt) : null,
        }),
      },
      include: { space: { include: { station: true } } },
    });

    const spaceId = existing.spaceId;
    if (!spaceId || !existing.space) return updated;

    // Lead disetujui → unit jadi TERISI + buat occupancy tenant
    if (status === "CLOSED_WON") {
      const stationId = existing.space.stationId;
      let tenant = await tx.tenant.findFirst({
        where: {
          stationId,
          brandName: { equals: existing.companyName, mode: "insensitive" },
        },
      });

      if (!tenant) {
        tenant = await tx.tenant.create({
          data: {
            stationId,
            brandName: existing.companyName,
            contactName: existing.contactName,
            phone: existing.phone,
            email: existing.email,
            notes: `Dari lead ${existing.id}`,
          },
        });
      }

      await tx.spaceOccupancy.upsert({
        where: { spaceId },
        create: {
          spaceId,
          tenantId: tenant.id,
          startDate: new Date(),
        },
        update: {
          tenantId: tenant.id,
          startDate: new Date(),
        },
      });

      await tx.commercialSpace.update({
        where: { id: spaceId },
        data: { status: "TERISI" },
      });

      // Lead aktif lain di unit yang sama ditolak
      await tx.tenantLead.updateMany({
        where: {
          spaceId,
          id: { not: id },
          status: { in: ["NEW", "CONTACTED", "NEGOTIATING"] },
        },
        data: { status: "CLOSED_LOST" },
      });
    }

    // Lead dibatalkan/ditolak → unit kembali TERSEDIA jika tidak ada occupancy lain
    if (
      status === "CLOSED_LOST" &&
      existing.status === "CLOSED_WON" &&
      existing.space.status === "TERISI"
    ) {
      const occupancy = await tx.spaceOccupancy.findUnique({ where: { spaceId } });
      if (occupancy) {
        await tx.spaceOccupancy.delete({ where: { id: occupancy.id } });
      }
      await tx.commercialSpace.update({
        where: { id: spaceId },
        data: { status: "TERSEDIA" },
      });
    }

    return updated;
  });

  return NextResponse.json(lead);
}
