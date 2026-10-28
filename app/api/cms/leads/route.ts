import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { leadUpdateSchema } from "@/lib/api-schemas";
import {
  ACTIVE_LEAD_STATUSES,
  isCommercialOperation,
} from "@/lib/commercial-pipeline";

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
  const {
    id,
    status,
    siteVisitStatus,
    siteVisitScheduledAt,
    notes,
    followUpAt,
  } = parsed.data;
  const targetStatus = status === "CLOSED_WON" ? "COMMERCIAL_OPERATION" : status;

  const existing = await prisma.tenantLead.findUnique({
    where: { id },
    include: {
      space: {
        select: {
          id: true,
          stationId: true,
          status: true,
          occupancy: {
            include: {
              tenant: {
                select: { id: true, userId: true, brandName: true },
              },
            },
          },
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  }

  if (
    isCommercialOperation(existing.status) &&
    targetStatus &&
    !isCommercialOperation(targetStatus)
  ) {
    return NextResponse.json(
      {
        error:
          "Penyewaan sudah beroperasi. Akhiri melalui menu Penyewa Aktif, bukan dengan mengubah status pengajuan.",
      },
      { status: 409 }
    );
  }

  // Site visit dihandle melalui pipeline steps di probis 1

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const spaceId = existing.spaceId;
      const space = existing.space;

      if (targetStatus === "PKS" || targetStatus === "FIT_OUT_HANDOVER") {
        if (!spaceId || !space) {
          throw new Error("SPACE_REQUIRED");
        }
        if (space.occupancy) {
          throw new Error("SPACE_OCCUPIED");
        }

        const competing = await tx.tenantLead.findFirst({
          where: {
            spaceId,
            id: { not: id },
            status: {
              in: ["PKS", "FIT_OUT_HANDOVER", "COMMERCIAL_OPERATION", "CLOSED_WON"],
            },
          },
          select: { id: true },
        });
        if (competing) {
          throw new Error("SPACE_RESERVED");
        }

        await tx.commercialSpace.update({
          where: { id: spaceId },
          data: {
            status: targetStatus === "PKS" ? "RESERVED" : "FIT_OUT",
          },
        });

        if (targetStatus === "PKS") {
          await tx.tenantLead.updateMany({
            where: {
              spaceId,
              id: { not: id },
              status: { in: ACTIVE_LEAD_STATUSES },
            },
            data: { status: "CLOSED_LOST" },
          });
        }
      }

      if (targetStatus === "COMMERCIAL_OPERATION") {
        if (!spaceId || !space) {
          throw new Error("SPACE_REQUIRED");
        }
        if (
          space.occupancy &&
          space.occupancy.tenant.userId !== existing.userId
        ) {
          throw new Error("SPACE_OCCUPIED");
        }

        let tenant = existing.userId
          ? await tx.tenant.findFirst({
              where: { userId: existing.userId, stationId: space.stationId },
            })
          : null;

        if (!tenant) {
          tenant = await tx.tenant.findFirst({
            where: {
              stationId: space.stationId,
              brandName: { equals: existing.companyName, mode: "insensitive" },
            },
          });
        }

        if (tenant) {
          tenant = await tx.tenant.update({
            where: { id: tenant.id },
            data: {
              userId: existing.userId ?? tenant.userId,
              brandName: existing.companyName,
              contactName: existing.contactName,
              phone: existing.phone,
              email: existing.email,
              isActive: true,
            },
          });
        } else {
          tenant = await tx.tenant.create({
            data: {
              userId: existing.userId,
              stationId: space.stationId,
              brandName: existing.companyName,
              contactName: existing.contactName,
              phone: existing.phone,
              email: existing.email,
              notes: `Konversi otomatis dari pengajuan ${existing.id}`,
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
            endDate: null,
          },
        });

        await tx.commercialSpace.update({
          where: { id: spaceId },
          data: { status: "TERISI" },
        });

        await tx.tenantLead.updateMany({
          where: {
            spaceId,
            id: { not: id },
            status: { in: ACTIVE_LEAD_STATUSES },
          },
          data: { status: "CLOSED_LOST" },
        });
      }

      if (
        targetStatus &&
        ["NEW", "CONTACTED", "NEGOTIATING", "CLOSED_LOST"].includes(targetStatus) &&
        spaceId &&
        space &&
        !space.occupancy &&
        ["RESERVED", "FIT_OUT"].includes(space.status)
      ) {
        await tx.commercialSpace.update({
          where: { id: spaceId },
          data: { status: "TERSEDIA" },
        });
      }

      return tx.tenantLead.update({
        where: { id },
        data: {
          ...(targetStatus && { status: targetStatus }),
          ...(notes !== undefined && { notes }),
          ...(followUpAt !== undefined && {
            followUpAt: followUpAt ? new Date(followUpAt) : null,
          }),
        },
        include: { space: { include: { station: true } } },
      });
    });

    return NextResponse.json(lead);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "SPACE_REQUIRED") {
      return NextResponse.json(
        { error: "Tahap ini memerlukan unit komersial yang terhubung." },
        { status: 400 }
      );
    }
    if (message === "SPACE_OCCUPIED") {
      return NextResponse.json(
        { error: "Unit sudah ditempati penyewa lain." },
        { status: 409 }
      );
    }
    if (message === "SPACE_RESERVED") {
      return NextResponse.json(
        { error: "Unit sudah direservasi oleh pengajuan lain." },
        { status: 409 }
      );
    }
    console.error("[cms/leads] update failed", error);
    return NextResponse.json(
      { error: "Gagal memperbarui proses pengajuan." },
      { status: 500 }
    );
  }
}
