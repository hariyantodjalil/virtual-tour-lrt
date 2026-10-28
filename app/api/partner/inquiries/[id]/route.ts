import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ["MITRA"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID pengajuan tidak valid." }, { status: 400 });
  }

  const lead = await prisma.tenantLead.findFirst({
    where: {
      id,
      OR: [
        { userId: auth.user.userId },
        { email: auth.user.email },
      ],
    },
    include: {
      space: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          status: true,
          area: true,
          leasableAreaDetail: true,
          leasingModel: true,
          floor: true,
          location: true,
          nearestExit: true,
          nearbyFacilities: true,
          powerSupply: true,
          waterAccess: true,
          airConditioning: true,
          fitOutTerms: true,
          description: true,
          panoramaUrl: true,
          station: {
            select: {
              id: true,
              name: true,
              slug: true,
              address: true,
              location: true,
              line: true,
              imageUrl: true,
            },
          },
        },
      },
      workflowVersion: {
        select: {
          id: true,
          version: true,
          title: true,
          description: true,
          steps: {
            orderBy: { stepOrder: "asc" },
            select: {
              id: true,
              stepOrder: true,
              title: true,
              description: true,
              publicMessage: true,
              requiresMedia: true,
            },
          },
        },
      },
      stepLogs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          stepOrder: true,
          action: true,
          notes: true,
          performedBy: true,
          createdAt: true,
          pipelineStep: {
            select: {
              id: true,
              stepOrder: true,
              title: true,
            },
          },
        },
      },
      mediaAttachments: {
        where: { isVisibleToMitra: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          stepOrder: true,
          mediaTitle: true,
          documentNumber: true,
          mediaLink: true,
          isVisibleToMitra: true,
          uploadedByAdmin: true,
          createdAt: true,
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json(
      { error: "Pengajuan sewa tidak ditemukan atau Anda tidak memiliki akses." },
      { status: 404 }
    );
  }

  let workflowVersion = lead.workflowVersion;
  if (!workflowVersion) {
    workflowVersion = await prisma.pipelineWorkflowVersion.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        title: true,
        description: true,
        steps: {
          orderBy: { stepOrder: "asc" },
          select: {
            id: true,
            stepOrder: true,
            title: true,
            description: true,
            publicMessage: true,
            requiresMedia: true,
          },
        },
      },
    });
  }

  return NextResponse.json({ ...lead, workflowVersion });
}
