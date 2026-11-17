import { prisma } from "@/lib/prisma";
import { cmsLeadSummaryInclude } from "@/lib/partner-inquiries";
import LeadsClient from "./LeadsClient";
import type { CmsLeadSummary } from "./lead-types";

export const dynamic = "force-dynamic";

async function getLeads(): Promise<{
  leads: CmsLeadSummary[];
  error: string | null;
}> {
  try {
    const rows = await prisma.tenantLead.findMany({
      orderBy: { createdAt: "desc" },
      include: cmsLeadSummaryInclude,
    });

    const leads: CmsLeadSummary[] = rows.map((lead) => ({
      id: lead.id,
      inquiryCode: lead.inquiryCode,
      userId: lead.userId,
      companyName: lead.companyName,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email,
      businessType: lead.businessType,
      spaceRequirement: lead.spaceRequirement,
      status: lead.status,
      currentStepOrder: lead.currentStepOrder,
      siteVisitStatus: lead.siteVisitStatus,
      siteVisitScheduledAt: lead.siteVisitScheduledAt?.toISOString() ?? null,
      rejectionReason: lead.rejectionReason,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      space: lead.space
        ? {
            id: lead.space.id,
            code: lead.space.code,
            name: lead.space.name,
            type: lead.space.type,
            status: lead.space.status,
            station: {
              id: lead.space.station.id,
              name: lead.space.station.name,
              code: lead.space.station.code,
            },
          }
        : null,
      workflowVersion: lead.workflowVersion
        ? {
            id: lead.workflowVersion.id,
            version: lead.workflowVersion.version,
            title: lead.workflowVersion.title,
            status: lead.workflowVersion.status,
            steps: lead.workflowVersion.steps,
          }
        : null,
      stepLogs: lead.stepLogs.map((log) => ({
        id: log.id,
        stepOrder: log.stepOrder,
        status: log.status,
        action: log.action,
        createdAt: log.createdAt.toISOString(),
      })),
      _count: lead._count,
    }));

    return { leads, error: null };
  } catch (error) {
    console.error("Failed to load CMS leads", error);
    return {
      leads: [],
      error: "Data pengajuan gagal dimuat. Muat ulang halaman untuk mencoba kembali.",
    };
  }
}

export default async function CmsLeadsPage() {
  const { leads, error } = await getLeads();
  const initialNowIso = new Date().toISOString();

  return (
    <LeadsClient
      initialLeads={leads}
      initialLoadError={error}
      initialNowIso={initialNowIso}
    />
  );
}
