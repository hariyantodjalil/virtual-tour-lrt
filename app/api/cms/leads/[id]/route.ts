import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCommercialOperation, SPACE_HOLD_STATUSES } from "@/lib/commercial-pipeline";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
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

    await prisma.$transaction(async (tx) => {
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
    });

    return NextResponse.json({ message: "Pengajuan dihapus" });
  } catch {
    return NextResponse.json({ error: "Lead tidak ditemukan" }, { status: 404 });
  }
}
