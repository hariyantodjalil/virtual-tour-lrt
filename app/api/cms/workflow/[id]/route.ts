import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { workflowDraftSaveSchema } from "@/lib/api-schemas";
import {
  cmsWorkflowVersionInclude,
  normalizeWorkflowStepsForSave,
  serializeWorkflowVersion,
  type WorkflowStepDraftInput,
} from "@/lib/cms-workflow";

type Context = { params: Promise<{ id: string }> };

/** PUT /api/cms/workflow/[id] — Simpan perubahan langkah pada versi berstatus `DRAFT`. */
export async function PUT(request: NextRequest, context: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const existing = await prisma.pipelineWorkflowVersion.findUnique({
    where: { id },
    select: { id: true, status: true, _count: { select: { leads: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Versi workflow tidak ditemukan." }, { status: 404 });
  }

  if (existing.status !== "DRAFT") {
    return NextResponse.json(
      {
        error:
          "Versi ACTIVE atau ARCHIVED bersifat terkunci (immutable). Buat draf versi baru untuk mengubah alur.",
      },
      { status: 400 }
    );
  }

  if (existing._count.leads > 0) {
    return NextResponse.json(
      {
        error:
          "Versi ini sudah terikat pengajuan mitra dan tidak dapat diubah lagi.",
      },
      { status: 400 }
    );
  }

  const parsed = await parseJsonRequest(request, workflowDraftSaveSchema);
  if (!parsed.success) return parsed.response;

  const normalizedSteps = normalizeWorkflowStepsForSave(
    parsed.data.steps as WorkflowStepDraftInput[],
    id
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.pipelineStep.deleteMany({
      where: { workflowVersionId: id },
    });

    await tx.pipelineStep.createMany({
      data: normalizedSteps,
    });

    return tx.pipelineWorkflowVersion.update({
      where: { id },
      data: {
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
      },
      include: cmsWorkflowVersionInclude,
    });
  });

  return NextResponse.json({
    version: serializeWorkflowVersion(updated),
  });
}

/** DELETE /api/cms/workflow/[id] — Hapus draf workflow yang belum memiliki pengajuan terkait. */
export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const existing = await prisma.pipelineWorkflowVersion.findUnique({
    where: { id },
    select: { id: true, status: true, _count: { select: { leads: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Versi workflow tidak ditemukan." }, { status: 404 });
  }

  if (existing.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Hanya versi berstatus DRAFT yang boleh dihapus." },
      { status: 400 }
    );
  }

  if (existing._count.leads > 0) {
    return NextResponse.json(
      { error: "Draf yang sudah memiliki pengajuan terkait tidak dapat dihapus." },
      { status: 400 }
    );
  }

  await prisma.pipelineWorkflowVersion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
