import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/api-validation";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { partnerInquiryInclude, toPartnerInquiry } from "@/lib/partner-inquiries";
import { publishInquiryEvent } from "@/lib/realtime-events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const lead = await prisma.tenantLead.findFirst({ where: { id, userId: auth.user.userId }, include: partnerInquiryInclude });
  if (!lead) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  return NextResponse.json(toPartnerInquiry(lead), { headers: { "Cache-Control": "private, no-store" } });
}

const visitSchema = z.object({ surveyPreference: z.string().trim().min(3).max(500) }).strict();
const negotiationStatuses = ["NEW", "CONTACTED", "RDS_OFFER", "NEGOTIATING", "SITE_CHECK"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const limit = consumeRateLimit(request, "inquiry-site-visit", { limit: 10, windowMs: 600000, subject: auth.user.userId });
  if (!limit.allowed) return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429, headers: rateLimitHeaders(limit) });
  const parsed = await parseJsonRequest(request, visitSchema);
  if (!parsed.success) return parsed.response;
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async tx => {
      // Ownership-scoped lock: another account cannot inspect or modify this inquiry.
      await tx.$executeRaw`SELECT id FROM tenant_leads WHERE id = ${id} AND "userId" = ${auth.user.userId} FOR UPDATE`;
      const lead = await tx.tenantLead.findFirst({ where: { id, userId: auth.user.userId } });
      if (!lead) return { error: "Pengajuan tidak ditemukan.", status: 404 };
      if (!(negotiationStatuses as readonly string[]).includes(lead.status)) return { error: "Site visit dapat diajukan sebelum negosiasi selesai.", status: 409 };
      if (["REQUESTED", "SCHEDULED", "COMPLETED"].includes(lead.siteVisitStatus)) return { error: "Site visit sudah diajukan atau ditangani tim. Hubungi tim untuk perubahan jadwal.", status: 409 };
      await tx.tenantLead.update({ where: { id }, data: { surveyPreference: parsed.data.surveyPreference, siteVisitStatus: "REQUESTED" } });
      await tx.inquiryStepLog.create({ data: { tenantLeadId: id, stepOrder: 3, status: lead.status, action: "SITE_VISIT_REQUESTED", notes: "Mitra mengajukan site visit sebagai bagian negosiasi.", performedBy: auth.user.userId } });
      return { ok: true };
    }, { isolationLevel: "Serializable" });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    void publishInquiryEvent({
      kind: "lead-updated",
      leadId: id,
      userId: auth.user.userId,
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Pengajuan sedang diperbarui. Muat ulang lalu coba lagi." }, { status: 409 });
    return NextResponse.json({ error: "Permintaan site visit belum tersimpan. Silakan coba lagi." }, { status: 500 });
  }
}
