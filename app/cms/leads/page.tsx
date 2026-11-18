import { prisma } from "@/lib/prisma";
import { cmsLeadInclude, toCmsLeadItem } from "@/lib/cms-leads";
import LeadsClient from "./LeadsClient";

export const dynamic = "force-dynamic";

export default async function CmsLeadsPage() {
  let initialLeads: ReturnType<typeof toCmsLeadItem>[] = [];
  let error: string | null = null;
  try {
    const leads = await prisma.tenantLead.findMany({ orderBy: { createdAt: "desc" }, include: cmsLeadInclude });
    initialLeads = leads.map(toCmsLeadItem);
  } catch {
    error = "Data pengajuan gagal dimuat. Data tidak diubah.";
  }
  return <LeadsClient initialLeads={initialLeads} initialLoadError={error} />;
}
