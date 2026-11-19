import { Prisma } from "@prisma/client";
import { cmsTrainInquirySelect } from "@/lib/train-advertising";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { leadUpdateSchema } from "@/lib/api-schemas";
import { recordInquiryStatus } from "@/lib/partner-inquiries";
import { ACTIVE_LEAD_STATUSES, canonicalLeadStatus, completedLeadStageIndex, isCommercialOperation, publicLeadStageIndex, SPACE_HOLD_STATUSES } from "@/lib/commercial-pipeline";
import { inquirySiteVisitStep, inquiryTransitionError, pinnedInquiryTransitionError, resolveInquiryAdvance } from "@/lib/inquiry-workflow";
import { publishInquiryEvent } from "@/lib/realtime-events";

function holdsForStatus(status: Parameters<typeof canonicalLeadStatus>[0]) {
  return SPACE_HOLD_STATUSES.includes(status) || status === "FIT_OUT_HANDOVER";
}

function pinnedSpaceHold(steps: readonly { stepOrder: number; spaceEffect: string }[], order: number) {
  return steps.reduce<{ stepOrder: number; spaceEffect: string } | undefined>((last, step) => {
    if (step.stepOrder > order || !["RESERVE_SPACE", "FIT_OUT_SPACE"].includes(step.spaceEffect)) return last;
    return !last || step.stepOrder > last.stepOrder ? step : last;
  }, undefined)?.spaceEffect;
}

const include = { trainInquiry: { select: cmsTrainInquirySelect }, space: { include: { station: true } } } satisfies Prisma.TenantLeadInclude;
class WorkflowError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const leads = await prisma.tenantLead.findMany({ orderBy: { createdAt: "desc" }, include });
  return NextResponse.json(leads, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, leadUpdateSchema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;
  try {
    const lead = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM tenant_leads WHERE id = ${input.id} FOR UPDATE`;
      const existing = await tx.tenantLead.findUnique({ where: { id: input.id }, include: { mediaAttachments: true, trainInquiry: true, workflowVersion: { include: { steps: { orderBy: { stepOrder: "asc" } } } } } });
      if (!existing) throw new WorkflowError("Pengajuan tidak ditemukan.", 404);

      let nextWorkflowVersionId = existing.workflowVersionId;
      let nextStepOrder = existing.currentStepOrder;
      let workflowReassigned:
        | { fromId: string | null; toId: string; toTitle: string; toVersion: number | null; firstStepId: string }
        | null = null;

      if (input.workflowVersionId !== undefined && input.workflowVersionId !== existing.workflowVersionId) {
        if (existing.status !== "NEW" || existing.currentStepOrder !== 1) {
          throw new WorkflowError(
            "Alur hanya bisa diganti saat pengajuan masih di tahap 1 (status Pengajuan Diterima)."
          );
        }
        if (input.status && canonicalLeadStatus(input.status) !== "NEW") {
          throw new WorkflowError("Ganti alur dulu, baru lanjutkan ke tahap berikutnya.");
        }
        const version = await tx.pipelineWorkflowVersion.findUnique({
          where: { id: input.workflowVersionId },
          select: {
            id: true,
            title: true,
            version: true,
            status: true,
            steps: {
              orderBy: { stepOrder: "asc" },
              select: { id: true, stepOrder: true, leadStatus: true },
            },
          },
        });
        if (!version || version.status !== "ACTIVE") {
          throw new WorkflowError("Pilih versi alur yang berstatus Aktif.", 400);
        }
        const first =
          version.steps.find((step) => step.leadStatus === "NEW") ?? version.steps[0];
        if (!first) {
          throw new WorkflowError("Versi alur yang dipilih belum punya tahap awal.", 400);
        }
        nextWorkflowVersionId = version.id;
        nextStepOrder = first.stepOrder;
        workflowReassigned = {
          fromId: existing.workflowVersionId,
          toId: version.id,
          toTitle: version.title,
          toVersion: version.version,
          firstStepId: first.id,
        };
      }

      const steps = existing.workflowVersion?.steps ?? [];
      const currentStep = steps.find(step => step.stepOrder === existing.currentStepOrder);
      const advance = input.advance ? resolveInquiryAdvance(steps, existing.currentStepOrder, input.advance) : null;
      if (input.advance && (input.status || workflowReassigned || !advance || existing.status === "CLOSED_LOST")) {
        throw new WorkflowError("Tahap sudah berubah. Muat ulang pengajuan sebelum melanjutkan.");
      }
      const target = advance?.next.leadStatus ?? (input.status ? canonicalLeadStatus(input.status) : existing.status);
      const changedStatus = target !== existing.status;
      if (steps.length && changedStatus && !advance && target !== "CLOSED_LOST") {
        throw new WorkflowError("Lanjutkan dari tahap aktif pada alur pengajuan.");
      }
      const transitioned = changedStatus || Boolean(advance);
      const canActivateNext = steps.some(step => step.stepOrder === existing.currentStepOrder + 1 && step.spaceEffect === "ACTIVATE_TENANT");
      const active = isCommercialOperation(existing.status);
      if (active && (changedStatus || input.leaseStartAt !== undefined || input.leaseEndAt !== undefined || input.paymentVerified === false)) {
        throw new WorkflowError("Sewa sudah aktif. Perubahan kontrak atau penghentian dikelola melalui Penyewa Aktif.");
      }
      const leaseStartAt = input.leaseStartAt === undefined ? existing.leaseStartAt : input.leaseStartAt ? new Date(input.leaseStartAt) : null;
      const leaseEndAt = input.leaseEndAt === undefined ? existing.leaseEndAt : input.leaseEndAt ? new Date(input.leaseEndAt) : null;
      if (leaseStartAt && leaseEndAt && leaseEndAt < leaseStartAt) throw new WorkflowError("Tanggal akhir sewa tidak boleh sebelum tanggal mulai.", 400);
      const visit = input.siteVisitStatus ?? (input.siteVisitScheduledAt ? "SCHEDULED" : existing.siteVisitStatus);
      const scheduledAt = input.siteVisitScheduledAt === undefined ? existing.siteVisitScheduledAt : input.siteVisitScheduledAt ? new Date(input.siteVisitScheduledAt) : null;
      if (visit === "SCHEDULED" && !scheduledAt) throw new WorkflowError("Tanggal dan waktu site visit wajib diisi.", 400);
      const visitStep = inquirySiteVisitStep(steps);
      if ((input.siteVisitStatus !== undefined || input.siteVisitScheduledAt !== undefined) && (visitStep ? existing.currentStepOrder > visitStep.stepOrder : completedLeadStageIndex(existing.status) >= 2)) {
        throw new WorkflowError("Site visit dikelola selama negosiasi, sebelum negosiasi dinyatakan selesai.");
      }
      if (input.paymentVerified === true && !canActivateNext && completedLeadStageIndex(target) < 4) throw new WorkflowError("Verifikasi pembayaran dilakukan setelah PKS ditandatangani.");
      const paymentVerifiedAt = input.paymentVerified === undefined ? existing.paymentVerifiedAt : input.paymentVerified ? existing.paymentVerifiedAt ?? new Date() : null;
      const state = { status: target, leaseStartAt, leaseEndAt, paymentVerifiedAt, siteVisitStatus: visit, siteVisitStepOrder: visitStep?.stepOrder, mediaAttachments: existing.mediaAttachments };
      // Run the gate on the current pinned step before recording a transition.
      if (advance || changedStatus) {
        const error = advance ? pinnedInquiryTransitionError(advance.current, advance.next, state) : inquiryTransitionError(existing.status, target, state);
        if (error) throw new WorkflowError(error);
      }
      if (target === "CLOSED_LOST" && changedStatus && !(input.rejectionReason ?? existing.rejectionReason)?.trim()) throw new WorkflowError("Isi alasan penghentian agar mitra mengetahui hasil pengajuannya.", 400);

      const spaceId = existing.spaceId;
      if (spaceId && transitioned) await tx.$executeRaw`SELECT id FROM commercial_spaces WHERE id = ${spaceId} FOR UPDATE`;
      const space = spaceId ? await tx.commercialSpace.findUnique({ where: { id: spaceId }, include: { occupancy: { include: { tenant: true } } } }) : null;
      const stepHold = advance ? pinnedSpaceHold(steps, advance.next.stepOrder) : undefined;
      const holds = advance ? Boolean(stepHold) || (existing.workflowVersionId === "gitdev-leasing-v1" && holdsForStatus(target)) : holdsForStatus(target);
      const otherLeads = space && transitioned ? await tx.tenantLead.findMany({
        where: { spaceId, id: { not: input.id }, status: { in: [...ACTIVE_LEAD_STATUSES, "COMMERCIAL_OPERATION", "CLOSED_WON"] } },
        select: { id: true, status: true, workflowVersionId: true, currentStepOrder: true, workflowVersion: { select: { steps: { select: { stepOrder: true, spaceEffect: true } } } } },
      }) : [];
      const otherHold = otherLeads.some(other => isCommercialOperation(other.status)
        || Boolean(pinnedSpaceHold(other.workflowVersion?.steps ?? [], other.currentStepOrder))
        || ((!other.workflowVersionId || other.workflowVersionId === "gitdev-leasing-v1") && holdsForStatus(other.status))
        || (other.workflowVersionId === "verified-leasing-20261117" && space && ["RESERVED", "FIT_OUT"].includes(space.status) && holdsForStatus(other.status)));
      if (transitioned && !existing.trainInquiry && (holds || isCommercialOperation(target))) {
        if (!spaceId || !space) throw new WorkflowError("Tahap ini memerlukan unit komersial yang terhubung.", 400);
        if (space.status === "MAINTENANCE" || (space.status === "TERISI" && !space.occupancy)) throw new WorkflowError("Unit sedang maintenance atau terisi. Perbarui ketersediaan unit terlebih dahulu.");
        if (space.occupancy && (holds || space.occupancy.tenant.userId !== existing.userId)) throw new WorkflowError("Unit sudah ditempati penyewa lain.");
        if (otherHold) throw new WorkflowError("Unit sudah direservasi oleh pengajuan lain.");
        await tx.commercialSpace.update({ where: { id: spaceId }, data: { status: isCommercialOperation(target) ? "TERISI" : stepHold === "FIT_OUT_SPACE" || target === "FIT_OUT_HANDOVER" ? "FIT_OUT" : "RESERVED" } });
        for (const other of otherLeads.filter(other => ACTIVE_LEAD_STATUSES.includes(other.status))) {
          await tx.tenantLead.update({ where: { id: other.id }, data: { status: "CLOSED_LOST", rejectionReason: "Unit sudah dialokasikan untuk pengajuan lain." } });
          await recordInquiryStatus(tx, { id: other.id, workflowVersionId: other.workflowVersionId, stepOrder: other.currentStepOrder, fromStatus: other.status, status: "CLOSED_LOST", rejectionReason: "Unit sudah dialokasikan untuk pengajuan lain.", actor: auth.user.userId });
        }
        if (isCommercialOperation(target)) {
          if (!existing.userId) throw new WorkflowError("Hubungkan akun mitra sebelum mengaktifkan sewa.");
          // Never match another tenant just by brand name: ownership follows the inquiry account.
          const tenantData = { userId: existing.userId, stationId: space.stationId, brandName: existing.companyName, contactName: existing.contactName, phone: existing.phone, email: existing.email, isActive: true };
          const previous = await tx.tenant.findFirst({ where: { userId: existing.userId, stationId: space.stationId } });
          const tenant = previous ? await tx.tenant.update({ where: { id: previous.id }, data: tenantData }) : await tx.tenant.create({ data: tenantData });
          await tx.spaceOccupancy.upsert({ where: { spaceId }, create: { spaceId, tenantId: tenant.id, startDate: leaseStartAt, endDate: leaseEndAt }, update: { tenantId: tenant.id, startDate: leaseStartAt, endDate: leaseEndAt } });
        }
      }
      if (changedStatus && existing.trainInquiry && isCommercialOperation(target)) {
        const inquiry = existing.trainInquiry;
        if (!inquiry.allocatedTrainsets.length) throw new WorkflowError("Alokasikan trainset sebelum mengaktifkan sewa.");
        const count = await tx.trainset.count({ where: { trainId: inquiry.trainId, code: { in: inquiry.allocatedTrainsets }, isActive: true } });
        if (count !== inquiry.allocatedTrainsets.length) throw new WorkflowError("Alokasi harus menggunakan trainset aktif.");
        if (inquiry.requestedTrainsetCount !== null && inquiry.allocatedTrainsets.length !== inquiry.requestedTrainsetCount) throw new WorkflowError("Jumlah alokasi trainset harus sesuai permintaan pengajuan.");
      }
      const previouslyHeld = Boolean(pinnedSpaceHold(steps, existing.currentStepOrder)) ||
        ((!existing.workflowVersionId || ["gitdev-leasing-v1", "verified-leasing-20261117"].includes(existing.workflowVersionId)) && holdsForStatus(existing.status));
      if (changedStatus && target === "CLOSED_LOST" && previouslyHeld && space && !space.occupancy && ["RESERVED", "FIT_OUT"].includes(space.status)) {
        if (!otherHold) await tx.commercialSpace.update({ where: { id: space.id }, data: { status: "TERSEDIA" } });
      }
      const updated = await tx.tenantLead.update({ where: { id: input.id }, data: {
        ...(changedStatus && { status: target }),
        ...(advance && { currentStepOrder: advance.next.stepOrder }),
        ...(workflowReassigned && {
          workflowVersionId: nextWorkflowVersionId,
          currentStepOrder: nextStepOrder,
        }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.followUpAt !== undefined && { followUpAt: input.followUpAt ? new Date(input.followUpAt) : null }),
        ...(input.siteVisitStatus !== undefined || input.siteVisitScheduledAt !== undefined ? { siteVisitStatus: visit, siteVisitScheduledAt: scheduledAt } : {}),
        ...(input.rdsOfferNo !== undefined && { rdsOfferNo: input.rdsOfferNo?.trim() || null }),
        ...(input.baNegotiationNo !== undefined && { baNegotiationNo: input.baNegotiationNo?.trim() || null }),
        ...(input.leaseStartAt !== undefined && { leaseStartAt }),
        ...(input.leaseEndAt !== undefined && { leaseEndAt }),
        ...(input.paymentVerified !== undefined && { paymentVerifiedAt, paymentVerifiedByAdmin: input.paymentVerified ? existing.paymentVerifiedByAdmin ?? auth.user.userId : null }),
        ...(input.rejectionReason !== undefined && { rejectionReason: input.rejectionReason?.trim() || null }),
        ...(changedStatus && target !== "CLOSED_LOST" && { rejectionReason: null }),
      }, include });
      if (workflowReassigned) {
        const versionLabel =
          typeof workflowReassigned.toVersion === "number"
            ? `v${workflowReassigned.toVersion}`
            : "versi aktif";
        await tx.inquiryStepLog.create({
          data: {
            tenantLeadId: input.id,
            pipelineStepId: workflowReassigned.firstStepId,
            stepOrder: nextStepOrder,
            status: "NEW",
            fromStatus: "NEW",
            action: "WORKFLOW_REASSIGNED",
            notes: `Alur diganti ke ${versionLabel} — ${workflowReassigned.toTitle}.`,
            performedBy: auth.user.userId,
          },
        });
      }
      if (transitioned) {
        await recordInquiryStatus(tx, {
          id: input.id,
          workflowVersionId: nextWorkflowVersionId,
          stepOrder: advance?.next.stepOrder ?? currentStep?.stepOrder,
          fromStatus: existing.status,
          status: target,
          rejectionReason: input.rejectionReason ?? existing.rejectionReason,
          partnerMessage: input.partnerMessage,
          actor: auth.user.userId,
        });
      } else if (input.partnerMessage !== undefined) {
        const partnerMessage = input.partnerMessage?.trim();
        if (partnerMessage) {
          const leadStatus = isCommercialOperation(existing.status)
            ? "COMMERCIAL_OPERATION"
            : existing.status;
          const step = nextWorkflowVersionId
            ? await tx.pipelineStep.findFirst({
                where: { workflowVersionId: nextWorkflowVersionId, stepOrder: workflowReassigned ? nextStepOrder : existing.currentStepOrder },
              })
            : null;
          const publicOrder = Math.max(1, publicLeadStageIndex(leadStatus) + 1);
          await tx.inquiryStepLog.create({
            data: {
              tenantLeadId: input.id,
              pipelineStepId: step?.id,
              stepOrder: step?.stepOrder ?? publicOrder,
              status: existing.status,
              fromStatus: existing.status,
              action: "PARTNER_NOTE",
              notes: partnerMessage,
              performedBy: auth.user.userId,
            },
          });
        }
      }
      if (input.paymentVerified !== undefined && Boolean(existing.paymentVerifiedAt) !== input.paymentVerified) await tx.inquiryStepLog.create({ data: { tenantLeadId: input.id, stepOrder: advance?.next.stepOrder ?? existing.currentStepOrder, status: target, action: input.paymentVerified ? "PAYMENT_VERIFIED" : "PAYMENT_VERIFICATION_REVOKED", notes: input.paymentVerified ? "Pembayaran telah diverifikasi tim komersial." : "Verifikasi pembayaran diperbarui tim komersial.", performedBy: auth.user.userId } });
      return updated;
    }, { isolationLevel: "Serializable", timeout: 15000 });
    void publishInquiryEvent({
      kind: "lead-updated",
      leadId: lead.id,
      userId: lead.userId,
    });
    return NextResponse.json(lead, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof WorkflowError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Pengajuan sedang diperbarui. Muat ulang dan coba lagi." }, { status: 409 });
    console.error("[cms/leads] update failed", error);
    return NextResponse.json({ error: "Gagal memperbarui proses pengajuan." }, { status: 500 });
  }
}
