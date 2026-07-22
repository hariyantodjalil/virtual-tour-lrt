import { prisma } from "@/lib/prisma";
import LeadsClient, { type LeadItem } from "./LeadsClient";

export const dynamic = "force-dynamic";

async function getLeads(): Promise<LeadItem[]> {
  try {
    const leads = await prisma.tenantLead.findMany({
      orderBy: { createdAt: "desc" },
      include: { space: { include: { station: { select: { name: true } } } } },
    });

    return leads.map((lead) => ({
      id: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email,
      businessType: lead.businessType,
      status: lead.status,
      createdAt: lead.createdAt.toISOString(),
      space: lead.space
        ? { code: lead.space.code, station: { name: lead.space.station.name } }
        : null,
    }));
  } catch {
    return [];
  }
}

export default async function CmsLeadsPage() {
  const leads = await getLeads();
  return <LeadsClient initialLeads={leads} />;
}
