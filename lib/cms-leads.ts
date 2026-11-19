import type { Prisma } from "@prisma/client";
import { cmsTrainInquirySelect } from "./train-advertising";
import type { LeadItem } from "./cms-leads-shared";

export const cmsLeadInclude = {
  trainInquiry: { select: cmsTrainInquirySelect },
  workflowVersion: {
    select: {
      id: true,
      version: true,
      title: true,
      status: true,
      steps: {
        orderBy: { stepOrder: "asc" as const },
        select: {
          id: true,
          stepOrder: true,
          leadStatus: true,
          stepType: true,
          documentNumberLabel: true,
          slaHours: true,
          mediaRequirement: true,
          requiresMedia: true,
          spaceEffect: true,
          title: true,
          description: true,
          publicMessage: true,
          showInSummary: true,
        },
      },
    },
  },
  space: {
    include: {
      station: {
        select: { name: true, code: true, slug: true, line: true, imageUrl: true },
      },
    },
  },
  stepLogs: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      stepOrder: true,
      status: true,
      action: true,
      notes: true,
      createdAt: true,
    },
  },
} satisfies Prisma.TenantLeadInclude;

type CmsLeadRow = Prisma.TenantLeadGetPayload<{ include: typeof cmsLeadInclude }>;

/** Call only after staff authorization. Never reuse this projection on partner/public endpoints. */
export function toCmsLeadItem(lead: CmsLeadRow): LeadItem {
  return {
    id: lead.id,
    inquiryCode: lead.inquiryCode,
    trainInquiry: lead.trainInquiry ? { ...lead.trainInquiry, campaignStart: lead.trainInquiry.campaignStart?.toISOString() ?? null, campaignEnd: lead.trainInquiry.campaignEnd?.toISOString() ?? null } : null,
    rejectionReason: lead.rejectionReason,
    userId: lead.userId,
    companyName: lead.companyName,
    contactName: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    businessType: lead.businessType,
    status: lead.status,
    message: lead.message,
    surveyPreference: lead.surveyPreference,
    siteVisitStatus: lead.siteVisitStatus,
    siteVisitScheduledAt: lead.siteVisitScheduledAt?.toISOString() ?? null,
    notes: lead.notes,
    followUpAt: lead.followUpAt?.toISOString() ?? null,
    leaseStartAt: lead.leaseStartAt?.toISOString() ?? null,
    leaseEndAt: lead.leaseEndAt?.toISOString() ?? null,
    paymentVerifiedAt: lead.paymentVerifiedAt?.toISOString() ?? null,
    rdsOfferNo: lead.rdsOfferNo,
    baNegotiationNo: lead.baNegotiationNo,
    updatedAt: lead.updatedAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    currentStepOrder: lead.currentStepOrder,
    workflowVersion: lead.workflowVersion
      ? {
          id: lead.workflowVersion.id,
          version: lead.workflowVersion.version,
          title: lead.workflowVersion.title,
          status: lead.workflowVersion.status,
          stepCount: lead.workflowVersion.steps.length,
          steps: lead.workflowVersion.steps.map((step) => ({
            id: step.id,
            stepOrder: step.stepOrder,
            leadStatus: step.leadStatus,
            stepType: step.stepType as
              | "STANDARD"
              | "DOCUMENT_ISSUANCE"
              | "SITE_VISIT",
            documentNumberLabel: step.documentNumberLabel,
            slaHours: step.slaHours,
            mediaRequirement: step.mediaRequirement as
              | "NONE"
              | "OPTIONAL"
              | "REQUIRED",
            requiresMedia: step.requiresMedia,
            spaceEffect: step.spaceEffect as
              | "NONE"
              | "RESERVE_SPACE"
              | "FIT_OUT_SPACE"
              | "ACTIVATE_TENANT",
            title: step.title,
            description: step.description,
            publicMessage: step.publicMessage,
            showInSummary: step.showInSummary,
          })),
        }
      : null,
    space: lead.space
      ? {
          id: lead.space.id,
          code: lead.space.code,
          name: lead.space.name,
          status: lead.space.status,
          type: lead.space.type,
          area: lead.space.area,
          floor: lead.space.floor,
          location: lead.space.location,
          nearestExit: lead.space.nearestExit,
          powerSupply: lead.space.powerSupply,
          waterAccess: lead.space.waterAccess,
          airConditioning: lead.space.airConditioning,
          panoramaUrl: lead.space.panoramaUrl,
          station: {
            name: lead.space.station.name,
            code: lead.space.station.code,
            slug: lead.space.station.slug,
            line: lead.space.station.line,
            imageUrl: lead.space.station.imageUrl,
          },
        }
      : null,
    stepLogs: lead.stepLogs.map((log) => ({
      id: log.id,
      stepOrder: log.stepOrder,
      status: log.status,
      action: log.action,
      notes: log.notes,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
