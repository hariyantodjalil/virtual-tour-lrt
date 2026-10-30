import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { leadUpdateSchema } from "@/lib/api-schemas";
import { recordInquiryStatus } from "@/lib/partner-inquiries";
import {
  ACTIVE_LEAD_STATUSES,
  isAtOrAfterLeadStage,
  isCommercialOperation,
  SPACE_HOLD_STATUSES,
} from "@/lib/commercial-pipeline";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const leads = await prisma.tenantLead.findMany({
    orderBy: { createdAt: "desc" },
    include: { space: { include: { station: true } } },
  });
  return NextResponse.json(leads);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
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
    rdsOfferNo,
    baNegotiationNo,
    rejectionReason,
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

  const nextSiteVisitStatus =
    siteVisitStatus ??
    (siteVisitScheduledAt ? "SCHEDULED" : undefined);
  const scheduledAt =
    siteVisitScheduledAt === undefined
      ? existing.siteVisitScheduledAt
      : siteVisitScheduledAt
        ? new Date(siteVisitScheduledAt)
        : null;

  if (nextSiteVisitStatus === "SCHEDULED" && !scheduledAt) {
    return NextResponse.json(
      { error: "Tanggal dan waktu site visit wajib diisi ketika status dijadwalkan." },
      { status: 400 }
    );
  }

  const nextRdsOfferNo = (rdsOfferNo !== undefined ? rdsOfferNo : existing.rdsOfferNo)?.trim() || "";
  const nextBaNumber = (baNegotiationNo !== undefined ? baNegotiationNo : existing.baNegotiationNo)?.trim() || "";
  const nextVisit = nextSiteVisitStatus ?? existing.siteVisitStatus;

  if (targetStatus && isAtOrAfterLeadStage(targetStatus, "RDS_OFFER") && !nextRdsOfferNo) {
    return NextResponse.json(
      { error: "Nomor penawaran resmi wajib diisi sebelum tahap ini." },
      { status: 400 }
    );
  }
  if (targetStatus && isAtOrAfterLeadStage(targetStatus, "BA_SIGNED")) {
    if (nextVisit !== "COMPLETED") {
      return NextResponse.json(
        { error: "Verifikasi lokasi harus selesai sebelum BA Negosiasi." },
        { status: 400 }
      );
    }
    if (!nextBaNumber) {
      return NextResponse.json(
        { error: "Nomor BA Negosiasi wajib diisi sebelum review desain dan perjanjian." },
        { status: 400 }
      );
    }
  }

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const spaceId = existing.spaceId;
      const space = existing.space;

      const holdsSpace = targetStatus ? SPACE_HOLD_STATUSES.includes(targetStatus) : false;
      if (holdsSpace || targetStatus === "FIT_OUT_HANDOVER") {
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
              in: [...SPACE_HOLD_STATUSES, "FIT_OUT_HANDOVER", "COMMERCIAL_OPERATION", "CLOSED_WON"],
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
            status: targetStatus === "FIT_OUT_HANDOVER" ? "FIT_OUT" : "RESERVED",
          },
        });

        if (holdsSpace || targetStatus === "FIT_OUT_HANDOVER") {
          const affected = await tx.tenantLead.findMany({ where: { spaceId, id: { not: id }, status: { in: ACTIVE_LEAD_STATUSES } }, select: { id: true, status: true, workflowVersionId: true } });
          await tx.tenantLead.updateMany({
            where: {
              spaceId,
              id: { not: id },
              status: { in: ACTIVE_LEAD_STATUSES },
            },
            data: { status: "CLOSED_LOST", rejectionReason: "Unit sudah dialokasikan untuk pengajuan lain." },
          });
          for (const other of affected) await recordInquiryStatus(tx, { id: other.id, workflowVersionId: other.workflowVersionId, fromStatus: other.status, status: "CLOSED_LOST", rejectionReason: "Unit sudah dialokasikan untuk pengajuan lain.", actor: auth.user.userId });
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

        const affected = await tx.tenantLead.findMany({ where: { spaceId, id: { not: id }, status: { in: ACTIVE_LEAD_STATUSES } }, select: { id: true, status: true, workflowVersionId: true } });
        await tx.tenantLead.updateMany({
          where: {
            spaceId,
            id: { not: id },
            status: { in: ACTIVE_LEAD_STATUSES },
          },
          data: { status: "CLOSED_LOST", rejectionReason: "Unit sudah dialokasikan untuk pengajuan lain." },
        });
        for (const other of affected) await recordInquiryStatus(tx, { id: other.id, workflowVersionId: other.workflowVersionId, fromStatus: other.status, status: "CLOSED_LOST", rejectionReason: "Unit sudah dialokasikan untuk pengajuan lain.", actor: auth.user.userId });
      }

      if (
        targetStatus &&
        !isAtOrAfterLeadStage(targetStatus, "BA_SIGNED") &&
        spaceId &&
        space &&
        !space.occupancy &&
        ["RESERVED", "FIT_OUT"].includes(space.status)
      ) {
        const otherHold = await tx.tenantLead.findFirst({
          where: {
            spaceId,
            id: { not: id },
            status: { in: [...SPACE_HOLD_STATUSES, "FIT_OUT_HANDOVER"] },
          },
          select: { status: true },
        });
        if (!otherHold) {
          await tx.commercialSpace.update({
            where: { id: spaceId },
            data: { status: "TERSEDIA" },
          });
        }
      }

      const updated = await tx.tenantLead.update({
        where: { id },
        data: {
          ...(targetStatus && { status: targetStatus }),
          ...(notes !== undefined && { notes }),
          ...(followUpAt !== undefined && {
            followUpAt: followUpAt ? new Date(followUpAt) : null,
          }),
          ...(nextSiteVisitStatus && { siteVisitStatus: nextSiteVisitStatus }),
          ...(siteVisitScheduledAt !== undefined && {
            siteVisitScheduledAt: scheduledAt,
          }),
          ...(rdsOfferNo !== undefined && { rdsOfferNo: nextRdsOfferNo || null }),
          ...(baNegotiationNo !== undefined && { baNegotiationNo: nextBaNumber || null }),
          ...(rejectionReason !== undefined && { rejectionReason: rejectionReason || null }),
          ...(targetStatus && targetStatus !== "CLOSED_LOST" && { rejectionReason: null }),
        },
        include: { space: { include: { station: true } } },
      });
      if (targetStatus && targetStatus !== existing.status) await recordInquiryStatus(tx, { id, workflowVersionId: existing.workflowVersionId, fromStatus: existing.status, status: targetStatus, rejectionReason: rejectionReason ?? existing.rejectionReason, actor: auth.user.userId });
      return updated;
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
