import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { partnerInquiryInclude, toPartnerInquiry } from "@/lib/partner-inquiries";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const lead = await prisma.tenantLead.findFirst({ where: { id, userId: auth.user.userId }, include: partnerInquiryInclude });
  if (!lead) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  return NextResponse.json(toPartnerInquiry(lead), { headers: { "Cache-Control": "private, no-store" } });
}
