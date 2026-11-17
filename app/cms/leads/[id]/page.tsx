import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cmsLeadDetailInclude } from "@/lib/partner-inquiries";
import LeadDetailWorkspace from "./LeadDetailWorkspace";
import type { CmsLeadDetail } from "../lead-types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CmsLeadDetailPage({ params }: Props) {
  const { id } = await params;

  const row = await prisma.tenantLead.findUnique({
    where: { id },
    include: cmsLeadDetailInclude,
  });

  if (!row) {
    notFound();
  }

  const initialLead: CmsLeadDetail = {
    id: row.id,
    inquiryCode: row.inquiryCode,
    userId: row.userId,
    spaceId: row.spaceId,
    workflowVersionId: row.workflowVersionId,
    companyName: row.companyName,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    businessType: row.businessType,
    spaceRequirement: row.spaceRequirement,
    message: row.message,
    status: row.status,
    currentStepOrder: row.currentStepOrder,
    surveyPreference: row.surveyPreference,
    siteVisitStatus: row.siteVisitStatus,
    siteVisitScheduledAt: row.siteVisitScheduledAt?.toISOString() ?? null,
    notes: row.notes,
    rdsOfferNo: row.rdsOfferNo,
    baNegotiationNo: row.baNegotiationNo,
    rejectionReason: row.rejectionReason,
    followUpAt: row.followUpAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    space: row.space
      ? {
          id: row.space.id,
          code: row.space.code,
          name: row.space.name,
          type: row.space.type,
          status: row.space.status,
          area: row.space.area,
          lengthM: row.space.lengthM,
          widthM: row.space.widthM,
          heightM: row.space.heightM,
          areaKind: row.space.areaKind,
          exposure: row.space.exposure,
          floor: row.space.floor,
          location: row.space.location,
          nearestExit: row.space.nearestExit,
          nearbyFacilities: row.space.nearbyFacilities,
          powerSupply: row.space.powerSupply,
          waterAccess: row.space.waterAccess,
          airConditioning: row.space.airConditioning,
          description: row.space.description,
          panoramaUrl: row.space.panoramaUrl,
          station: {
            id: row.space.station.id,
            code: row.space.station.code,
            name: row.space.station.name,
            slug: row.space.station.slug,
            address: row.space.station.address,
            location: row.space.station.location,
            line: row.space.station.line,
            dailyPassengers: row.space.station.dailyPassengers,
            imageUrl: row.space.station.imageUrl,
          },
          parentZone: row.space.parentZone,
          occupancy: row.space.occupancy
            ? {
                id: row.space.occupancy.id,
                tenant: {
                  id: row.space.occupancy.tenant.id,
                  userId: row.space.occupancy.tenant.userId,
                  brandName: row.space.occupancy.tenant.brandName,
                },
              }
            : null,
        }
      : null,
    workflowVersion: row.workflowVersion
      ? {
          id: row.workflowVersion.id,
          version: row.workflowVersion.version,
          title: row.workflowVersion.title,
          description: row.workflowVersion.description,
          status: row.workflowVersion.status,
          steps: row.workflowVersion.steps,
        }
      : null,
    stepLogs: row.stepLogs.map((log) => ({
      id: log.id,
      stepOrder: log.stepOrder,
      status: log.status,
      fromStatus: log.fromStatus,
      action: log.action,
      notes: log.notes,
      documentNumber: log.documentNumber,
      visitStatus: log.visitStatus,
      scheduledAt: log.scheduledAt?.toISOString() ?? null,
      performedBy: log.performedBy,
      createdAt: log.createdAt.toISOString(),
      pipelineStep: log.pipelineStep,
    })),
    mediaAttachments: row.mediaAttachments.map((media) => ({
      id: media.id,
      stepOrder: media.stepOrder,
      mediaTitle: media.mediaTitle,
      documentNumber: media.documentNumber,
      mediaLink: media.mediaLink,
      isVisibleToMitra: media.isVisibleToMitra,
      uploadedByAdmin: media.uploadedByAdmin,
      createdAt: media.createdAt.toISOString(),
    })),
    _count: row._count,
  };

  return (
    <LeadDetailWorkspace
      initialLead={initialLead}
      initialNowIso={new Date().toISOString()}
    />
  );
}
