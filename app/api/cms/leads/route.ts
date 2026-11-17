import { NextRequest, NextResponse } from "next/server";
import type { LeadStatus, Prisma, SiteVisitStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { leadUpdateSchema } from "@/lib/api-schemas";
import {
  cmsLeadDetailInclude,
  cmsLeadSummaryInclude,
  recordInquiryStatus,
} from "@/lib/partner-inquiries";
import {
  ACTIVE_LEAD_STATUSES,
  SPACE_HOLD_STATUSES,
} from "@/lib/commercial-pipeline";
import { publishInquiryEvent } from "@/lib/realtime-events";

class ApiDomainError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

type ExistingLeadDetail = Prisma.TenantLeadGetPayload<{
  include: typeof cmsLeadDetailInclude;
}>;
type WorkflowStep = NonNullable<ExistingLeadDetail["workflowVersion"]>["steps"][number];

async function rejectCompetingLeadsForSpace(
  tx: Prisma.TransactionClient,
  input: { spaceId: string; excludeLeadId: string; actor: string }
) {
  const affected = await tx.tenantLead.findMany({
    where: {
      spaceId: input.spaceId,
      id: { not: input.excludeLeadId },
      status: { in: ACTIVE_LEAD_STATUSES },
    },
    select: {
      id: true,
      status: true,
      currentStepOrder: true,
      workflowVersionId: true,
    },
  });
  if (affected.length === 0) return;

  await tx.tenantLead.updateMany({
    where: {
      spaceId: input.spaceId,
      id: { not: input.excludeLeadId },
      status: { in: ACTIVE_LEAD_STATUSES },
    },
    data: {
      status: "CLOSED_LOST",
      rejectionReason: "Unit sudah dialokasikan untuk pengajuan lain.",
    },
  });

  for (const other of affected) {
    await recordInquiryStatus(tx, {
      id: other.id,
      workflowVersionId: other.workflowVersionId,
      fromStatus: other.status,
      status: "CLOSED_LOST",
      stepOrder: other.currentStepOrder,
      rejectionReason: "Unit sudah dialokasikan untuk pengajuan lain.",
      actor: input.actor,
    });
  }
}

async function hasOtherSpaceHold(
  tx: Prisma.TransactionClient,
  input: { spaceId: string; excludeLeadId: string }
): Promise<boolean> {
  const otherLeads = await tx.tenantLead.findMany({
    where: {
      spaceId: input.spaceId,
      id: { not: input.excludeLeadId },
      status: { not: "CLOSED_LOST" },
    },
    select: {
      id: true,
      status: true,
      currentStepOrder: true,
      workflowVersion: {
        select: {
          steps: {
            select: { stepOrder: true, spaceEffect: true },
          },
        },
      },
    },
  });

  return otherLeads.some((other) => {
    if (
      [
        ...SPACE_HOLD_STATUSES,
        "FIT_OUT_HANDOVER",
        "COMMERCIAL_OPERATION",
        "CLOSED_WON",
      ].includes(other.status)
    ) {
      return true;
    }
    const otherStep = other.workflowVersion?.steps.find(
      (step) => step.stepOrder === other.currentStepOrder
    );
    return (
      otherStep?.spaceEffect === "RESERVE_SPACE" ||
      otherStep?.spaceEffect === "FIT_OUT_SPACE" ||
      otherStep?.spaceEffect === "ACTIVATE_TENANT"
    );
  });
}

async function applySpaceHoldEffect(
  tx: Prisma.TransactionClient,
  input: {
    space: ExistingLeadDetail["space"];
    spaceId: string | null;
    leadId: string;
    effect: "RESERVE_SPACE" | "FIT_OUT_SPACE";
    actor: string;
  }
) {
  const { space, spaceId, leadId, effect, actor } = input;
  if (!spaceId || !space) return;
  if (space.occupancy) {
    throw new ApiDomainError(409, "Unit sudah ditempati penyewa lain.");
  }

  const competingHold = await hasOtherSpaceHold(tx, {
    spaceId,
    excludeLeadId: leadId,
  });

  if (competingHold) {
    throw new ApiDomainError(409, "Unit sudah direservasi oleh pengajuan lain.");
  }

  await tx.commercialSpace.update({
    where: { id: spaceId },
    data: {
      status: effect === "FIT_OUT_SPACE" ? "FIT_OUT" : "RESERVED",
    },
  });

  await rejectCompetingLeadsForSpace(tx, {
    spaceId,
    excludeLeadId: leadId,
    actor,
  });
}

async function activateTenantForLead(
  tx: Prisma.TransactionClient,
  input: { existing: ExistingLeadDetail; actor: string }
) {
  const { existing, actor } = input;
  const { spaceId, space } = existing;
  if (!spaceId || !space) return;

  if (space.occupancy && space.occupancy.tenant.userId !== existing.userId) {
    throw new ApiDomainError(409, "Unit sudah ditempati penyewa lain.");
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

  await rejectCompetingLeadsForSpace(tx, {
    spaceId,
    excludeLeadId: existing.id,
    actor,
  });
}

async function releaseSpaceHoldIfUnused(
  tx: Prisma.TransactionClient,
  input: { spaceId: string | null; space: ExistingLeadDetail["space"]; excludeLeadId: string }
) {
  const { spaceId, space, excludeLeadId } = input;
  if (!spaceId || !space || space.occupancy) return;
  if (!["RESERVED", "FIT_OUT"].includes(space.status)) return;

  const otherHold = await hasOtherSpaceHold(tx, {
    spaceId,
    excludeLeadId,
  });

  if (!otherHold) {
    await tx.commercialSpace.update({
      where: { id: spaceId },
      data: { status: "TERSEDIA" },
    });
  }
}

function resolveDocumentNumberInput(input: {
  currentStep: WorkflowStep;
  existing: ExistingLeadDetail;
  existingLog: ExistingLeadDetail["stepLogs"][number] | undefined;
  bodyDocumentNumber?: string | null;
  rdsOfferNo?: string | null;
  baNegotiationNo?: string | null;
}) {
  const { currentStep, existing, existingLog, bodyDocumentNumber, rdsOfferNo, baNegotiationNo } =
    input;
  if (currentStep.stepType !== "DOCUMENT_ISSUANCE") {
    return { provided: false, value: null as string | null };
  }

  let incoming: string | null | undefined;
  if (bodyDocumentNumber !== undefined) {
    incoming = bodyDocumentNumber?.trim() || null;
  } else if (currentStep.leadStatus === "RDS_OFFER" && rdsOfferNo !== undefined) {
    incoming = rdsOfferNo?.trim() || null;
  } else if (currentStep.leadStatus === "BA_SIGNED" && baNegotiationNo !== undefined) {
    incoming = baNegotiationNo?.trim() || null;
  }

  if (incoming !== undefined) {
    return { provided: true, value: incoming };
  }

  const fallback =
    existingLog?.documentNumber ??
    (currentStep.leadStatus === "RDS_OFFER"
      ? existing.rdsOfferNo
      : currentStep.leadStatus === "BA_SIGNED"
        ? existing.baNegotiationNo
        : null);

  return { provided: false, value: fallback ?? null };
}

function buildLegacyLeadSyncData(input: {
  currentStep: WorkflowStep;
  docNumber: string | null;
  visitStatus: SiteVisitStatus;
  scheduledAt: Date | null;
  notes?: string | null;
}) {
  const data: Prisma.TenantLeadUpdateInput = {};
  if (input.notes !== undefined) {
    data.notes = input.notes?.trim() || null;
  }
  if (input.currentStep.stepType === "DOCUMENT_ISSUANCE") {
    if (input.currentStep.leadStatus === "RDS_OFFER") {
      data.rdsOfferNo = input.docNumber;
    } else if (input.currentStep.leadStatus === "BA_SIGNED") {
      data.baNegotiationNo = input.docNumber;
    }
  }
  if (input.currentStep.stepType === "SITE_VISIT") {
    data.siteVisitStatus = input.visitStatus;
    data.siteVisitScheduledAt = input.scheduledAt;
  }
  return data;
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const leads = await prisma.tenantLead.findMany({
    orderBy: { createdAt: "desc" },
    include: cmsLeadSummaryInclude,
  });
  return NextResponse.json(leads, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonRequest(request, leadUpdateSchema);
  if (!parsed.success) return parsed.response;
  const data = parsed.data;

  const existing = await prisma.tenantLead.findUnique({
    where: { id: data.id },
    include: cmsLeadDetailInclude,
  });
  if (!existing) {
    return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  }

  if (data.operation === "SAVE_INTERNAL_NOTE") {
    const updated = await prisma.tenantLead.update({
      where: { id: existing.id },
      data: { notes: data.notes?.trim() || null },
      include: cmsLeadDetailInclude,
    });
    // Catatan internal tidak ditampilkan ke Mitra; cukup sinkronkan sesi CMS admin lain.
    void publishInquiryEvent({ kind: "lead-updated", leadId: existing.id, userId: null });
    return NextResponse.json(updated);
  }

  if (existing.status === "CLOSED_WON" || existing.status === "CLOSED_LOST") {
    return NextResponse.json(
      { error: "Seluruh tahapan pengajuan ini telah selesai atau dihentikan dan terkunci." },
      { status: 400 }
    );
  }

  const steps = existing.workflowVersion?.steps ?? [];
  const currentStep = steps.find((step) => step.stepOrder === existing.currentStepOrder);
  if (!currentStep) {
    return NextResponse.json(
      { error: "Konfigurasi tahap saat ini tidak ditemukan pada alur pengajuan." },
      { status: 400 }
    );
  }

  const currentStepLogs = existing.stepLogs.filter(
    (log) => log.stepOrder === currentStep.stepOrder
  );
  const activeStepLog =
    currentStepLogs.find(
      (log) => log.action !== "COMPLETED" && log.action !== "REJECTED"
    ) ?? currentStepLogs.at(-1);

  const docResolution = resolveDocumentNumberInput({
    currentStep,
    existing,
    existingLog: activeStepLog,
    bodyDocumentNumber: data.documentNumber,
    rdsOfferNo: data.rdsOfferNo,
    baNegotiationNo: data.baNegotiationNo,
  });

  const effectiveVisitStatus: SiteVisitStatus =
    currentStep.stepType === "SITE_VISIT"
      ? (data.siteVisitStatus ?? activeStepLog?.visitStatus ?? existing.siteVisitStatus)
      : existing.siteVisitStatus;

  const effectiveScheduledAt: Date | null =
    currentStep.stepType === "SITE_VISIT"
      ? data.siteVisitScheduledAt !== undefined
        ? data.siteVisitScheduledAt
          ? new Date(data.siteVisitScheduledAt)
          : null
        : (activeStepLog?.scheduledAt ?? existing.siteVisitScheduledAt ?? null)
      : existing.siteVisitScheduledAt;

  if (
    currentStep.stepType === "SITE_VISIT" &&
    data.operation !== "REJECT_STAGE" &&
    effectiveVisitStatus === "SCHEDULED" &&
    !effectiveScheduledAt
  ) {
    return NextResponse.json(
      { error: "Tanggal dan waktu verifikasi lokasi wajib diisi ketika status dijadwalkan." },
      { status: 400 }
    );
  }

  if (data.operation === "ADVANCE_STAGE") {
    if (currentStep.stepType === "DOCUMENT_ISSUANCE" && !docResolution.value) {
      return NextResponse.json(
        {
          error: `${currentStep.documentNumberLabel || "Nomor surat resmi"} wajib diisi sebelum menyelesaikan tahap ${currentStep.title}.`,
        },
        { status: 400 }
      );
    }

    if (
      currentStep.stepType === "SITE_VISIT" &&
      (effectiveVisitStatus === "SCHEDULED" || effectiveVisitStatus === "COMPLETED") &&
      !effectiveScheduledAt
    ) {
      return NextResponse.json(
        { error: "Tanggal & jam verifikasi lokasi wajib diisi." },
        { status: 400 }
      );
    }

    if (currentStep.mediaRequirement === "REQUIRED" || currentStep.requiresMedia) {
      const stageMediaCount = existing.mediaAttachments.filter(
        (media) => media.stepOrder === currentStep.stepOrder
      ).length;
      if (stageMediaCount === 0) {
        return NextResponse.json(
          {
            error: `Tahap ${currentStep.title} mewajibkan minimal 1 dokumen resmi diunggah sebelum dapat diselesaikan.`,
          },
          { status: 400 }
        );
      }
    }
  }

  try {
    const updatedLead = await prisma.$transaction(async (tx) => {
      if (data.operation === "REJECT_STAGE") {
        const reason = data.rejectionReason?.trim() || "Pengajuan dihentikan oleh Tim Komersial.";
        await releaseSpaceHoldIfUnused(tx, {
          spaceId: existing.spaceId,
          space: existing.space,
          excludeLeadId: existing.id,
        });

        await tx.inquiryStepLog.create({
          data: {
            tenantLeadId: existing.id,
            pipelineStepId: currentStep.id,
            stepOrder: currentStep.stepOrder,
            status: "CLOSED_LOST",
            fromStatus: existing.status,
            action: "REJECTED",
            notes: reason,
            performedBy: auth.user.userId,
          },
        });

        return tx.tenantLead.update({
          where: { id: existing.id },
          data: {
            status: "CLOSED_LOST",
            rejectionReason: reason,
            ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
          },
          include: cmsLeadDetailInclude,
        });
      }

      const nextPublicNote =
        data.publicNote !== undefined
          ? data.publicNote?.trim() || null
          : (activeStepLog?.notes ?? null);

      const stepLogPayload = {
        notes: nextPublicNote,
        documentNumber:
          currentStep.stepType === "DOCUMENT_ISSUANCE" ? docResolution.value : null,
        visitStatus:
          currentStep.stepType === "SITE_VISIT" ? effectiveVisitStatus : null,
        scheduledAt:
          currentStep.stepType === "SITE_VISIT" ? effectiveScheduledAt : null,
        performedBy: auth.user.userId,
      };

      if (activeStepLog) {
        await tx.inquiryStepLog.update({
          where: { id: activeStepLog.id },
          data: stepLogPayload,
        });
      } else {
        await tx.inquiryStepLog.create({
          data: {
            tenantLeadId: existing.id,
            pipelineStepId: currentStep.id,
            stepOrder: currentStep.stepOrder,
            status: existing.status,
            action: currentStep.stepOrder === 1 ? "SUBMITTED" : "STATUS_CHANGED",
            ...stepLogPayload,
          },
        });
      }

      const legacySync = buildLegacyLeadSyncData({
        currentStep,
        docNumber: docResolution.value,
        visitStatus: effectiveVisitStatus,
        scheduledAt: effectiveScheduledAt,
        notes: data.notes,
      });

      if (data.operation === "SAVE_CURRENT_STEP") {
        return tx.tenantLead.update({
          where: { id: existing.id },
          data: legacySync,
          include: cmsLeadDetailInclude,
        });
      }

      // ADVANCE_STAGE: jalankan aktivasi jika tahap berjalan bertipe ACTIVATE_TENANT
      if (currentStep.spaceEffect === "ACTIVATE_TENANT") {
        await activateTenantForLead(tx, { existing, actor: auth.user.userId });
      }

      const nextStep = steps.find(
        (step) => step.stepOrder === currentStep.stepOrder + 1
      );

      if (nextStep) {
        if (
          nextStep.spaceEffect === "RESERVE_SPACE" ||
          nextStep.spaceEffect === "FIT_OUT_SPACE"
        ) {
          await applySpaceHoldEffect(tx, {
            space: existing.space,
            spaceId: existing.spaceId,
            leadId: existing.id,
            effect: nextStep.spaceEffect,
            actor: auth.user.userId,
          });
        }

        await tx.inquiryStepLog.create({
          data: {
            tenantLeadId: existing.id,
            pipelineStepId: nextStep.id,
            stepOrder: nextStep.stepOrder,
            status: nextStep.leadStatus as LeadStatus,
            fromStatus: existing.status,
            action: "STATUS_CHANGED",
            notes: null,
            performedBy: auth.user.userId,
          },
        });

        return tx.tenantLead.update({
          where: { id: existing.id },
          data: {
            ...legacySync,
            status: nextStep.leadStatus,
            currentStepOrder: nextStep.stepOrder,
            rejectionReason: null,
          },
          include: cmsLeadDetailInclude,
        });
      }

      // Tahap terakhir selesai -> CLOSED_WON
      await tx.inquiryStepLog.create({
        data: {
          tenantLeadId: existing.id,
          pipelineStepId: currentStep.id,
          stepOrder: currentStep.stepOrder,
          status: "CLOSED_WON",
          fromStatus: existing.status,
          action: "COMPLETED",
          ...stepLogPayload,
        },
      });

      return tx.tenantLead.update({
        where: { id: existing.id },
        data: {
          ...legacySync,
          status: "CLOSED_WON",
          currentStepOrder: currentStep.stepOrder,
          rejectionReason: null,
        },
        include: cmsLeadDetailInclude,
      });
    });

    await publishInquiryEvent({
      kind: "lead-updated",
      leadId: existing.id,
      userId: existing.userId,
    });
    if (
      data.operation === "ADVANCE_STAGE" &&
      (currentStep.spaceEffect === "ACTIVATE_TENANT" || updatedLead.status === "CLOSED_WON")
    ) {
      await publishInquiryEvent({
        kind: "tenancy-updated",
        leadId: existing.id,
        userId: existing.userId,
      });
    }

    return NextResponse.json(updatedLead);
  } catch (error) {
    if (error instanceof ApiDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[cms/leads] update failed", error);
    return NextResponse.json(
      { error: "Gagal memperbarui proses pengajuan." },
      { status: 500 }
    );
  }
}
