import type { LeadStatus, Prisma } from "@prisma/client";
import { publicTrainInquirySelect } from "@/lib/train-advertising";
import { prisma } from "@/lib/prisma";
import {
  isCommercialOperation,
  PUBLIC_LEAD_PROCESS_STEPS,
  publicLeadStageIndex,
  STANDARD_FIT_OUT_TERMS,
  STANDARD_LEASING_MODEL,
} from "@/lib/commercial-pipeline";
import {
  documentsForLeadStatus,
  publicStepOrderForDocumentType,
  type InquiryDocumentType,
} from "@/lib/inquiry-media";
import { formatArea } from "@/lib/unit-dimensions";

function fallbackPublicSteps() {
  return PUBLIC_LEAD_PROCESS_STEPS.map((step, index) => ({
    id: step.status,
    stepOrder: index + 1,
    leadStatus: step.status,
    stepType: index === 2 ? ("SITE_VISIT" as const) : ("STANDARD" as const),
    documentNumberLabel: null as string | null,
    slaHours: null as number | null,
    mediaRequirement:
      index === 1
        ? ("OPTIONAL" as const)
        : index === 2 || index === 3 || index === 4
          ? ("REQUIRED" as const)
          : ("NONE" as const),
    requiresMedia: index === 2 || index === 3 || index === 4,
    spaceEffect: index === 5 ? ("ACTIVATE_TENANT" as const) : ("NONE" as const),
    title: step.title,
    description: step.detail,
    publicMessage: step.detail,
    showInSummary: true,
  }));
}

function partnerStepOrderForDocument(
  documentType: string | null | undefined,
  steps: Array<{ stepOrder: number; leadStatus: string }>,
  leadStatus: string,
  storedOrder: number
) {
  const stored = steps.find(step => step.stepOrder === storedOrder);
  if (stored) return stored.stepOrder;
  if (documentType) {
    const owning = steps.find((step) =>
      documentsForLeadStatus(step.leadStatus)?.includes(
        documentType as InquiryDocumentType
      )
    );
    if (owning) return owning.stepOrder;
  }
  const byStatus = steps.find((step) => step.leadStatus === leadStatus);
  if (byStatus) return byStatus.stepOrder;
  return publicStepOrderForDocumentType(documentType, leadStatus);
}

const PARTNER_VISIBLE_LOG_ACTIONS = new Set([
  "SUBMITTED",
  "STATUS_CHANGED",
  "COMPLETED",
  "REJECTED",
  "SITE_VISIT_REQUESTED",
  "PAYMENT_VERIFIED",
  "PARTNER_NOTE",
]);

function publicDocumentLink(leadId: string, media: { id: string; storageKey?: string | null; mediaLink: string }) {
  const privateRoute = `/api/inquiries/${encodeURIComponent(leadId)}/documents/${encodeURIComponent(media.id)}`;
  if (media.storageKey || media.mediaLink === privateRoute) return privateRoute;
  try {
    const url = new URL(media.mediaLink);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export const publicWorkflowSelect = {
  id: true,
  version: true,
  title: true,
  description: true,
  status: true,
  steps: {
    orderBy: { stepOrder: "asc" },
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
  const pinnedSteps =
    lead.workflowVersion?.steps?.length
      ? lead.workflowVersion.steps.map((step) => ({
          id: step.id,
          stepOrder: step.stepOrder,
          leadStatus: step.leadStatus,
          stepType: step.stepType,
          documentNumberLabel: step.documentNumberLabel,
          slaHours: step.slaHours,
          mediaRequirement: step.mediaRequirement,
          requiresMedia: step.requiresMedia,
          spaceEffect: step.spaceEffect,
          title: step.title,
          description: step.description,
          publicMessage: step.publicMessage,
          showInSummary: step.showInSummary,
        }))
      : fallbackPublicSteps();
  const stepsByStatus = new Map(pinnedSteps.map((step) => [step.leadStatus, step]));
  const stepsByOrder = new Map(pinnedSteps.map((step) => [step.stepOrder, step]));

  return {
    id: lead.id, inquiryCode: lead.inquiryCode, userId: lead.userId,
    companyName: lead.companyName, contactName: lead.contactName, email: lead.email,
    phone: lead.phone, businessType: lead.businessType, spaceRequirement: lead.spaceRequirement,
    message: lead.message, status: lead.status,
    trainInquiry: lead.trainInquiry ? { ...lead.trainInquiry, campaignStart: lead.trainInquiry.campaignStart?.toISOString() ?? null, campaignEnd: lead.trainInquiry.campaignEnd?.toISOString() ?? null } : null,
    currentStepOrder: lead.currentStepOrder ?? stageIndex + 1,
    rejectionReason: lead.status === "CLOSED_LOST" ? lead.rejectionReason : null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    leaseStartAt: lead.leaseStartAt?.toISOString() ?? null,
    leaseEndAt: lead.leaseEndAt?.toISOString() ?? null,
    paymentVerifiedAt: lead.paymentVerifiedAt?.toISOString() ?? null,
    surveyPreference: lead.surveyPreference,
    siteVisitStatus: lead.siteVisitStatus,
    siteVisitScheduledAt: lead.siteVisitScheduledAt?.toISOString() ?? null,
    rdsOfferNo: lead.rdsOfferNo,
    baNegotiationNo: lead.baNegotiationNo,
    workflowVersion: {
      id: lead.workflowVersion?.id ?? "public-lead-process",
      version: lead.workflowVersion?.version ?? 1,
      title: lead.workflowVersion?.title ?? "Tahapan pengajuan sewa",
      description: lead.workflowVersion?.description ?? null,
      steps: pinnedSteps,
    },
    space: lead.space
      ? {
          id: lead.space.id,
          code: lead.space.code,
          name: lead.space.name,
          type: lead.space.type,
          status: lead.space.status,
          area: lead.space.area,
          lengthM: null,
          widthM: null,
          heightM: null,
          areaKind: "STANDALONE",
          exposure: lead.space.exposure,
          parentZone: null,
          floor: lead.space.floor,
          location: lead.space.location,
          monthlyRent: lead.space.monthlyRent,
          nearestExit: lead.space.nearestExit,
          nearbyFacilities: lead.space.nearbyFacilities,
          powerSupply: lead.space.powerSupply,
          waterAccess: lead.space.waterAccess ? "Tersedia" : "Tidak tersedia",
          airConditioning: lead.space.airConditioning ? "Tersedia" : "Tidak tersedia",
          description: lead.space.description,
          panoramaUrl: lead.space.panoramaUrl,
          leasableAreaDetail: formatArea(lead.space.area),
          leasingModel: STANDARD_LEASING_MODEL,
          fitOutTerms: STANDARD_FIT_OUT_TERMS,
          station: {
            id: lead.space.station.id,
            code: lead.space.station.code,
            name: lead.space.station.name,
            slug: lead.space.station.slug,
            address: lead.space.station.address,
            location: lead.space.station.location,
            line: lead.space.station.line,
            dailyPassengers: lead.space.station.dailyPassengers,
            imageUrl: lead.space.station.imageUrl,
          },
        }
      : null,
    stepLogs: lead.stepLogs
      .filter((log) => PARTNER_VISIBLE_LOG_ACTIONS.has(log.action))
      .map((log) => {
        const pinned =
          (log.pipelineStep
            ? stepsByOrder.get(log.pipelineStep.stepOrder)
            : undefined) ??
          stepsByOrder.get(log.stepOrder) ??
          stepsByStatus.get(log.status);
        const fallbackIndex = publicLeadStageIndex(log.status);
        const fallback = PUBLIC_LEAD_PROCESS_STEPS[fallbackIndex >= 0 ? fallbackIndex : 0];
        const stepOrder =
          log.pipelineStep?.stepOrder ??
          pinned?.stepOrder ??
          log.stepOrder ??
          (fallbackIndex >= 0 ? fallbackIndex : 0) + 1;
        const title =
          log.action === "SITE_VISIT_REQUESTED"
            ? "Permintaan site visit"
            : log.pipelineStep?.title ??
              pinned?.title ??
              fallback?.title ??
              "Pengajuan tidak dilanjutkan";
        const customNote = log.notes?.trim() || null;
        return {
          id: log.id,
          stepOrder,
          status: log.status,
          fromStatus: log.fromStatus ?? null,
          action: log.action,
          notes:
            log.action === "SITE_VISIT_REQUESTED"
              ? "Permintaan kunjungan lokasi diterima dalam proses negosiasi."
              : customNote ||
                pinned?.publicMessage ||
                pinned?.description ||
                fallback?.detail ||
                "Pengajuan tidak dilanjutkan.",
          documentNumber: log.documentNumber ?? null,
          visitStatus: log.visitStatus ?? null,
          scheduledAt: log.scheduledAt?.toISOString() ?? null,
          performedBy: ["SUBMITTED", "SITE_VISIT_REQUESTED"].includes(log.action)
            ? "Mitra"
            : "Tim Komersial",
          createdAt: log.createdAt.toISOString(),
          pipelineStep: {
            id: log.pipelineStep?.id ?? pinned?.id ?? fallback?.status ?? `step-${stepOrder}`,
            stepOrder,
            title,
          },
        };
      }),
    mediaAttachments: lead.mediaAttachments.flatMap((media) => {
      const mediaLink = publicDocumentLink(lead.id, media);
      return mediaLink
        ? [
            {
              id: media.id,
              stepOrder: partnerStepOrderForDocument(
                media.documentType,
                pinnedSteps,
                lead.status,
                media.stepOrder
              ),
              mediaTitle: media.mediaTitle,
              documentNumber: media.documentNumber,
              documentType: media.documentType,
              verifiedAt: media.verifiedAt?.toISOString() ?? null,
              mediaLink,
              isVisibleToMitra: true,
              uploadedByAdmin: "Tim Komersial",
              createdAt: media.createdAt.toISOString(),
            },
          ]
        : [];
    }),
    _count: { mediaAttachments: lead.mediaAttachments.length },
  };
}

export async function recordInquiryStatus(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    workflowVersionId: string | null;
    stepOrder?: number;
    fromStatus: LeadStatus;
    status: LeadStatus;
    rejectionReason?: string | null;
    /** Pesan publik ke mitra; default teks standar tahap. */
    partnerMessage?: string | null;
    actor: string;
  }
) {
  const effective = input.status === "CLOSED_LOST" ? input.fromStatus : input.status;
  const leadStatus = isCommercialOperation(effective) ? "COMMERCIAL_OPERATION" : effective;
  const canonicalStatus = PUBLIC_LEAD_PROCESS_STEPS[publicLeadStageIndex(leadStatus)]?.status;
  const exactStep = input.workflowVersionId ? await tx.pipelineStep.findFirst({ where: { workflowVersionId: input.workflowVersionId, ...(input.stepOrder ? { stepOrder: input.stepOrder } : { leadStatus }) } }) : null;
  const step = exactStep ?? (input.workflowVersionId && canonicalStatus ? await tx.pipelineStep.findFirst({ where: { workflowVersionId: input.workflowVersionId, leadStatus: canonicalStatus } }) : null);
  if (!step && input.status !== "CLOSED_LOST") throw new Error("INQUIRY_STAGE_MISSING");
  const partnerMessage = input.partnerMessage?.trim();
  // Pin progres ke stepOrder versi lead — publish alur baru tidak menggeser pointer ini.
  if (step && input.status !== "CLOSED_LOST" && !input.stepOrder) {
    await tx.tenantLead.update({
      where: { id: input.id },
      data: { currentStepOrder: step.stepOrder },
    });
  }
  await tx.inquiryStepLog.create({ data: {
    tenantLeadId: input.id, pipelineStepId: step?.id, stepOrder: step?.stepOrder ?? input.stepOrder ?? Math.max(1, publicLeadStageIndex(effective) + 1),
    status: input.status, fromStatus: input.fromStatus,
    action: input.status === "CLOSED_LOST" ? "REJECTED" : isCommercialOperation(input.status) ? "COMPLETED" : "STATUS_CHANGED",
    notes:
      input.status === "CLOSED_LOST"
        ? input.rejectionReason || "Pengajuan tidak dilanjutkan."
        : partnerMessage || step?.publicMessage,
    performedBy: input.actor,
  } });
}

export async function getWorkflowForNewInquiry() {
  const workflow = await prisma.pipelineWorkflowVersion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: publicWorkflowSelect,
  });
  const first =
    workflow?.steps.find((step) => step.leadStatus === "NEW") ?? workflow?.steps[0];
  return workflow && first ? { id: workflow.id, first } : null;
}

export function inquiryCreationData(userId: string, workflow: NonNullable<Awaited<ReturnType<typeof getWorkflowForNewInquiry>>>) {
  const { first } = workflow;
  return {
    workflowVersionId: workflow.id,
    currentStepOrder: first.stepOrder,
    stepLogs: {
      create: {
        pipelineStepId: first.id,
        stepOrder: first.stepOrder,
        status: first.leadStatus,
        action: "SUBMITTED",
        notes: first.publicMessage,
        performedBy: userId,
      },
    },
  };
}
