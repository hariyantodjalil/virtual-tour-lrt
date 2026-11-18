import type { LeadStatus, Prisma } from "@prisma/client";
import { publicTrainInquirySelect } from "@/lib/train-advertising";
import { prisma } from "@/lib/prisma";
import { isCommercialOperation, PUBLIC_LEAD_PROCESS_STEPS, publicLeadStageIndex } from "@/lib/commercial-pipeline";

function publicDocumentLink(leadId: string, media: { id: string; storageKey?: string | null; mediaLink: string }) {
  const privateRoute = `/api/inquiries/${encodeURIComponent(leadId)}/documents/${encodeURIComponent(media.id)}`;
  if (media.storageKey || media.mediaLink === privateRoute) return privateRoute;
  try {
    const url = new URL(media.mediaLink);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export const publicWorkflowSelect = {
  id: true, version: true, title: true, description: true,
  steps: { orderBy: { stepOrder: "asc" }, select: { id: true, stepOrder: true, leadStatus: true, title: true, description: true, publicMessage: true, requiresMedia: true, showInSummary: true } },
} satisfies Prisma.PipelineWorkflowVersionSelect;

export const partnerInquiryInclude = {
  trainInquiry: { select: publicTrainInquirySelect },
  space: { include: { station: true } },
  workflowVersion: { select: publicWorkflowSelect },
  stepLogs: { orderBy: { createdAt: "asc" }, include: { pipelineStep: { select: { id: true, stepOrder: true, title: true } } } },
  mediaAttachments: { where: { isVisibleToMitra: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.TenantLeadInclude;

type InquiryRow = Prisma.TenantLeadGetPayload<{ include: typeof partnerInquiryInclude }>;

/** Explicit public projection: CMS notes, staff IDs and hidden media stay server-side. */
export function toPartnerInquiry(lead: InquiryRow) {
  const stageIndex = publicLeadStageIndex(lead.status);
  return {
    id: lead.id, inquiryCode: lead.inquiryCode, userId: lead.userId,
    companyName: lead.companyName, contactName: lead.contactName, email: lead.email,
    phone: lead.phone, businessType: lead.businessType, spaceRequirement: lead.spaceRequirement,
    message: lead.message, status: lead.status,
    trainInquiry: lead.trainInquiry ? { ...lead.trainInquiry, campaignStart: lead.trainInquiry.campaignStart?.toISOString() ?? null, campaignEnd: lead.trainInquiry.campaignEnd?.toISOString() ?? null } : null,
    currentStepOrder: stageIndex + 1,
    rejectionReason: lead.status === "CLOSED_LOST" ? lead.rejectionReason : null,
    createdAt: lead.createdAt, updatedAt: lead.updatedAt,
    leaseStartAt: lead.leaseStartAt, leaseEndAt: lead.leaseEndAt, paymentVerifiedAt: lead.paymentVerifiedAt,
    surveyPreference: lead.surveyPreference, siteVisitStatus: lead.siteVisitStatus,
    siteVisitScheduledAt: lead.siteVisitScheduledAt, rdsOfferNo: lead.rdsOfferNo, baNegotiationNo: lead.baNegotiationNo,
    workflowVersion: lead.workflowVersion ? {
      id: lead.workflowVersion.id, version: lead.workflowVersion.version, title: "Tahapan pengajuan sewa",
      steps: PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => ({ id: step.status, stepOrder: index + 1, leadStatus: step.status, title: step.title, publicMessage: step.detail, showInSummary: true })),
    } : null,
    space: lead.space ? {
      id: lead.space.id, code: lead.space.code, name: lead.space.name, type: lead.space.type,
      status: lead.space.status, area: lead.space.area, floor: lead.space.floor,
      location: lead.space.location, monthlyRent: lead.space.monthlyRent,
      nearestExit: lead.space.nearestExit, nearbyFacilities: lead.space.nearbyFacilities,
      powerSupply: lead.space.powerSupply,
      waterAccess: lead.space.waterAccess ? "Tersedia" : "Tidak tersedia",
      airConditioning: lead.space.airConditioning ? "Tersedia" : "Tidak tersedia",
      description: lead.space.description, panoramaUrl: lead.space.panoramaUrl,
      leasableAreaDetail: null, leasingModel: null, fitOutTerms: null,
      station: { id: lead.space.station.id, name: lead.space.station.name, slug: lead.space.station.slug, address: lead.space.station.address, location: lead.space.station.location, line: lead.space.station.line, imageUrl: lead.space.station.imageUrl },
    } : null,
    stepLogs: lead.stepLogs.filter(log => ["SUBMITTED", "STATUS_CHANGED", "COMPLETED", "REJECTED", "SITE_VISIT_REQUESTED", "PAYMENT_VERIFIED"].includes(log.action)).map(log => {
      const index = publicLeadStageIndex(log.status);
      const step = PUBLIC_LEAD_PROCESS_STEPS[index];
      return { id: log.id, stepOrder: index + 1, action: log.action, notes: log.action === "SITE_VISIT_REQUESTED" ? "Permintaan kunjungan lokasi diterima dalam proses negosiasi." : step?.detail ?? "Pengajuan tidak dilanjutkan.", performedBy: ["SUBMITTED", "SITE_VISIT_REQUESTED"].includes(log.action) ? "Mitra" : "Tim Komersial", createdAt: log.createdAt, pipelineStep: { title: log.action === "SITE_VISIT_REQUESTED" ? "Permintaan site visit" : step?.title ?? "Pengajuan tidak dilanjutkan" } };
    }),
    mediaAttachments: lead.mediaAttachments.flatMap(media => {
      const mediaLink = publicDocumentLink(lead.id, media);
      return mediaLink ? [{ id: media.id, stepOrder: media.stepOrder, mediaTitle: media.mediaTitle, documentNumber: media.documentNumber, documentType: media.documentType, verifiedAt: media.verifiedAt, mediaLink, isVisibleToMitra: true, createdAt: media.createdAt }] : [];
    }),
    _count: { mediaAttachments: lead.mediaAttachments.length },
  };
}

export async function recordInquiryStatus(tx: Prisma.TransactionClient, input: { id: string; workflowVersionId: string | null; fromStatus: LeadStatus; status: LeadStatus; rejectionReason?: string | null; actor: string }) {
  const effective = input.status === "CLOSED_LOST" ? input.fromStatus : input.status;
  const leadStatus = isCommercialOperation(effective) ? "COMMERCIAL_OPERATION" : effective;
  const canonicalStatus = PUBLIC_LEAD_PROCESS_STEPS[publicLeadStageIndex(leadStatus)]?.status;
  const exactStep = input.workflowVersionId ? await tx.pipelineStep.findFirst({ where: { workflowVersionId: input.workflowVersionId, leadStatus } }) : null;
  const step = exactStep ?? (input.workflowVersionId && canonicalStatus ? await tx.pipelineStep.findFirst({ where: { workflowVersionId: input.workflowVersionId, leadStatus: canonicalStatus } }) : null);
  if (!input.workflowVersionId || !step) throw new Error("INQUIRY_STAGE_MISSING");
  await tx.inquiryStepLog.create({ data: {
    tenantLeadId: input.id, pipelineStepId: step.id, stepOrder: step.stepOrder,
    status: input.status, fromStatus: input.fromStatus,
    action: input.status === "CLOSED_LOST" ? "REJECTED" : isCommercialOperation(input.status) ? "COMPLETED" : "STATUS_CHANGED",
    notes: input.status === "CLOSED_LOST" ? input.rejectionReason || "Pengajuan tidak dilanjutkan." : step.publicMessage,
    performedBy: input.actor,
  } });
}

export async function inquiryCreationData(userId: string) {
  const workflow = await prisma.pipelineWorkflowVersion.findFirst({ where: { status: "ACTIVE" }, orderBy: { version: "desc" }, select: publicWorkflowSelect });
  const first = workflow?.steps.find(step => step.leadStatus === "NEW");
  if (!workflow || !first) throw new Error("Active inquiry workflow is missing NEW stage");
  return {
    workflowVersionId: workflow.id,
    stepLogs: { create: { pipelineStepId: first.id, stepOrder: first.stepOrder, status: "NEW" as const, action: "SUBMITTED", notes: first.publicMessage, performedBy: userId } },
  };
}
