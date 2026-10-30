import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isCommercialOperation } from "@/lib/commercial-pipeline";

export const publicWorkflowSelect = {
  id: true, version: true, title: true, description: true,
  steps: { orderBy: { stepOrder: "asc" }, select: { id: true, stepOrder: true, leadStatus: true, title: true, description: true, publicMessage: true, requiresMedia: true } },
} satisfies Prisma.PipelineWorkflowVersionSelect;

export const partnerInquiryInclude = {
  space: { include: { station: true } },
  workflowVersion: { select: publicWorkflowSelect },
  stepLogs: { orderBy: { createdAt: "asc" }, include: { pipelineStep: { select: { id: true, stepOrder: true, title: true } } } },
  mediaAttachments: { where: { isVisibleToMitra: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.TenantLeadInclude;

type InquiryRow = Prisma.TenantLeadGetPayload<{ include: typeof partnerInquiryInclude }>;

/** Explicit public projection: CMS notes, staff IDs and hidden media stay server-side. */
export function toPartnerInquiry(lead: InquiryRow) {
  const statusKey = isCommercialOperation(lead.status) ? "COMMERCIAL_OPERATION" : lead.status;
  const currentStep = lead.workflowVersion?.steps.find(step => step.leadStatus === statusKey);
  const latestLog = lead.stepLogs.at(-1);
  return {
    id: lead.id, inquiryCode: lead.inquiryCode, userId: lead.userId,
    companyName: lead.companyName, contactName: lead.contactName, email: lead.email,
    phone: lead.phone, businessType: lead.businessType, spaceRequirement: lead.spaceRequirement,
    message: lead.message, status: lead.status,
    currentStepOrder: currentStep?.stepOrder ?? latestLog?.stepOrder ?? 1,
    rejectionReason: lead.status === "CLOSED_LOST" ? lead.rejectionReason : null,
    createdAt: lead.createdAt, updatedAt: lead.updatedAt,
    surveyPreference: lead.surveyPreference, siteVisitStatus: lead.siteVisitStatus,
    siteVisitScheduledAt: lead.siteVisitScheduledAt, rdsOfferNo: lead.rdsOfferNo, baNegotiationNo: lead.baNegotiationNo,
    workflowVersion: lead.workflowVersion,
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
    stepLogs: lead.stepLogs.map(log => ({ id: log.id, stepOrder: log.stepOrder, action: log.action, notes: log.notes, performedBy: log.action === "SUBMITTED" ? "Mitra" : "Tim Komersial", createdAt: log.createdAt, pipelineStep: log.pipelineStep })),
    mediaAttachments: lead.mediaAttachments.map(media => ({ id: media.id, stepOrder: media.stepOrder, mediaTitle: media.mediaTitle, documentNumber: media.documentNumber, mediaLink: media.mediaLink, isVisibleToMitra: true, uploadedByAdmin: "Tim Komersial", createdAt: media.createdAt })),
    _count: { mediaAttachments: lead.mediaAttachments.length },
  };
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

export async function recordInquiryStatus(tx: Prisma.TransactionClient, input: { id: string; workflowVersionId: string | null; fromStatus: LeadStatus; status: LeadStatus; rejectionReason?: string | null; actor: string }) {
  if (!input.workflowVersionId) throw new Error("INQUIRY_STAGE_MISSING");
  const effective = input.status === "CLOSED_LOST" ? input.fromStatus : input.status;
  const leadStatus = isCommercialOperation(effective) ? "COMMERCIAL_OPERATION" : effective;
  const step = await tx.pipelineStep.findFirst({ where: { workflowVersionId: input.workflowVersionId, leadStatus } });
  if (!step) throw new Error("INQUIRY_STAGE_MISSING");
  await tx.inquiryStepLog.create({ data: {
    tenantLeadId: input.id, pipelineStepId: step.id, stepOrder: step.stepOrder,
    status: input.status, fromStatus: input.fromStatus,
    action: input.status === "CLOSED_LOST" ? "REJECTED" : isCommercialOperation(input.status) ? "COMPLETED" : "STATUS_CHANGED",
    notes: input.status === "CLOSED_LOST" ? input.rejectionReason || "Pengajuan tidak dilanjutkan." : step.publicMessage,
    performedBy: input.actor,
  } });
}
