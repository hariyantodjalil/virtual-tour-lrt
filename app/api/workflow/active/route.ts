import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeWorkflow = await prisma.pipelineWorkflowVersion.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { version: "desc" },
      include: {
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

    if (!activeWorkflow) {
      return NextResponse.json(
        { error: "Belum ada versi workflow aktif." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: activeWorkflow.id,
      version: activeWorkflow.version,
      title: activeWorkflow.title,
      description: activeWorkflow.description,
      status: activeWorkflow.status,
      steps: activeWorkflow.steps,
    });
  } catch (error) {
    console.error("[api/workflow/active GET]", error);
    return NextResponse.json(
      { error: "Gagal memuat tahapan alur penyewaan." },
      { status: 500 }
    );
  }
}
