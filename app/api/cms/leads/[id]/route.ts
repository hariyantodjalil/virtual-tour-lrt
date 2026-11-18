import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCommercialOperation, SPACE_HOLD_STATUSES } from "@/lib/commercial-pipeline";
import { cmsLeadInclude, toCmsLeadItem } from "@/lib/cms-leads";
import { isCmsLeadId } from "@/lib/cms-leads-shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const headers = { "Cache-Control": "private, no-store" };
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
  const { id } = await params;
  if (!isCmsLeadId(id)) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404, headers });
  try {
    const lead = await prisma.tenantLead.findUnique({ where: { id }, include: cmsLeadInclude });
    if (!lead) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404, headers });
    return NextResponse.json(toCmsLeadItem(lead), { headers });
  } catch {
    return NextResponse.json({ error: "Detail pengajuan gagal dimuat. Silakan coba lagi." }, { status: 500, headers });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  try {
    const lead = await prisma.tenantLead.findUnique({
      where: { id },
      include: { space: { select: { id: true, occupancy: { select: { id: true } } } } },
    });
    if (!lead) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
    }
    if (isCommercialOperation(lead.status)) {
      return NextResponse.json(
        {
          error:
            "Pengajuan yang sudah beroperasi disimpan sebagai riwayat. Kelola penghentian melalui Penyewa Aktif.",
        },
        { status: 409 }
      );
    }

    const removed = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM tenant_leads WHERE id = ${id} FOR UPDATE`;
      const latest = await tx.tenantLead.findUnique({ where: { id }, select: { status: true, _count: { select: { mediaAttachments: true } } } });
      if (!latest || isCommercialOperation(latest.status) || latest._count.mediaAttachments > 0) return false;
      await tx.tenantLead.delete({ where: { id } });

      if (
        lead.space &&
        !lead.space.occupancy &&
        [...SPACE_HOLD_STATUSES, "FIT_OUT_HANDOVER"].includes(lead.status)
      ) {
        const otherReservation = await tx.tenantLead.findFirst({
          where: {
            spaceId: lead.space.id,
            status: { in: [...SPACE_HOLD_STATUSES, "FIT_OUT_HANDOVER"] },
          },
          select: { status: true },
          orderBy: { updatedAt: "desc" },
        });
        await tx.commercialSpace.update({
          where: { id: lead.space.id },
          data: {
            status:
              otherReservation?.status === "FIT_OUT_HANDOVER"
                ? "FIT_OUT"
                : otherReservation
                  ? "RESERVED"
                  : "TERSEDIA",
          },
        });
      }
      return true;
    }, { isolationLevel: "Serializable" });
    if (!removed) return NextResponse.json({ error: "Pengajuan dengan dokumen atau sewa aktif disimpan untuk audit. Gunakan penghentian pengajuan, bukan hapus." }, { status: 409 });

    return NextResponse.json({ message: "Pengajuan dihapus" });
  } catch {
    return NextResponse.json({ error: "Lead tidak ditemukan" }, { status: 404 });
  }
}
