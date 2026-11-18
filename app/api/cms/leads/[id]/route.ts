import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cmsLeadDetailInclude } from "@/lib/partner-inquiries";
import { isInquiryFullyCompleted, SPACE_HOLD_STATUSES } from "@/lib/commercial-pipeline";
import { publishInquiryEvent } from "@/lib/realtime-events";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const lead = await prisma.tenantLead.findUnique({
    where: { id },
    include: cmsLeadDetailInclude,
  });

  if (!lead) {
    return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(lead, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

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
    if (isInquiryFullyCompleted(lead.status) || lead.space?.occupancy) {
      return NextResponse.json(
        {
          error:
            "Pengajuan yang telah selesai beroperasi atau sedang menempati unit disimpan sebagai riwayat. Kelola penghentian melalui Penyewa Aktif.",
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenantLead.delete({ where: { id } });

      if (lead.space && !lead.space.occupancy) {
        const remainingLeads = await tx.tenantLead.findMany({
          where: {
            spaceId: lead.space.id,
            status: { not: "CLOSED_LOST" },
          },
          select: {
            status: true,
            currentStepOrder: true,
            workflowVersion: {
              select: {
                steps: {
                  select: { stepOrder: true, spaceEffect: true },
                },
              },
            },
          },
        });

        let nextSpaceStatus: "FIT_OUT" | "RESERVED" | "TERSEDIA" = "TERSEDIA";
        for (const other of remainingLeads) {
          const activeStep = other.workflowVersion?.steps.find(
            (s) => s.stepOrder === other.currentStepOrder
          );
          const effect = activeStep?.spaceEffect;
          if (
            effect === "FIT_OUT_SPACE" ||
            effect === "ACTIVATE_TENANT" ||
            other.status === "FIT_OUT_HANDOVER" ||
            other.status === "COMMERCIAL_OPERATION" ||
            other.status === "CLOSED_WON"
          ) {
            nextSpaceStatus = "FIT_OUT";
            break;
          }
          if (
            effect === "RESERVE_SPACE" ||
            SPACE_HOLD_STATUSES.includes(other.status as (typeof SPACE_HOLD_STATUSES)[number])
          ) {
            nextSpaceStatus = "RESERVED";
          }
        }

        await tx.commercialSpace.update({
          where: { id: lead.space.id },
          data: { status: nextSpaceStatus },
        });
      }
    });

    await publishInquiryEvent({
      kind: "lead-deleted",
      leadId: id,
      userId: lead.userId,
    });

    return NextResponse.json({ message: "Pengajuan dihapus" });
  } catch {
    return NextResponse.json({ error: "Lead tidak ditemukan" }, { status: 404 });
  }
}
