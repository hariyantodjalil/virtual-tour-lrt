import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { isCommercialOperation } from "@/lib/commercial-pipeline";
import { parseJsonRequest } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

const allocationSchema = z.object({
  allocatedTrainsets: z.array(z.string().trim().min(1).max(32)).max(1000)
    .refine(codes => new Set(codes).size === codes.length, "Kode trainset tidak boleh duplikat."),
  allocationNotes: z.string().trim().max(5000).nullable(),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, allocationSchema);
  if (!parsed.success) return parsed.response;
  const { id } = await params;
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT id FROM tenant_leads WHERE id = ${id} FOR UPDATE`;
    const lead = await tx.tenantLead.findUnique({ where: { id }, include: { trainInquiry: true } });
    if (!lead?.trainInquiry) return { error: "Pengajuan kereta tidak ditemukan.", status: 404 };
    if (lead.status === "CLOSED_LOST") return { error: "Pengajuan sudah ditutup.", status: 409 };
    const inquiry = lead.trainInquiry;
    const { allocatedTrainsets, allocationNotes } = parsed.data;
    const activeCount = await tx.trainset.count({ where: { trainId: inquiry.trainId, code: { in: allocatedTrainsets }, isActive: true } });
    if (activeCount !== allocatedTrainsets.length) return { error: "Pilih trainset aktif dari armada yang sesuai.", status: 400 };
    if (isCommercialOperation(lead.status) && (!allocatedTrainsets.length || (inquiry.mode === "FULL_BRANDING" && inquiry.requestedTrainsetCount !== null && allocatedTrainsets.length !== inquiry.requestedTrainsetCount))) {
      return { error: "Alokasi pengajuan operasional harus sesuai permintaan.", status: 409 };
    }
    await tx.trainInquiry.update({ where: { leadId: id }, data: { allocatedTrainsets, allocationNotes: allocationNotes || null } });
    return null;
  });
  return result ? NextResponse.json({ error: result.error }, { status: result.status })
    : NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
