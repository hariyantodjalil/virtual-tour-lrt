import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cmsLeadInclude, toCmsLeadItem } from "@/lib/cms-leads";
import { cmsLeadDetailHref, isCmsLeadId } from "@/lib/cms-leads-shared";
import LeadDetailClient from "../LeadDetailClient";

export const dynamic = "force-dynamic";

export default async function CmsLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The parent layout also protects CMS, but this page checks before reading staff-only data.
  const auth = await requireRole(new NextRequest("http://localhost/cms/leads", { headers: await headers() }), ["ADMIN", "EDITOR"]);
  if ("error" in auth) {
    if (auth.status === 401) redirect(`/login?redirect=${encodeURIComponent(cmsLeadDetailHref(id))}`);
    notFound();
  }
  if (!isCmsLeadId(id)) notFound();
  const lead = await prisma.tenantLead.findUnique({ where: { id }, include: cmsLeadInclude });
  if (!lead) notFound();
  return <LeadDetailClient key={lead.id} initialLead={toCmsLeadItem(lead)} canManage={auth.user.role === "ADMIN"} />;
}
