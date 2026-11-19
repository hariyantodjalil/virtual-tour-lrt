import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { workflowDraftSaveSchema, workflowStatusPatchSchema } from "@/lib/api-schemas";
import {
  cmsWorkflowVersionInclude,
  lockWorkflowVersions,
  normalizeWorkflowStepsForSave,
  serializeWorkflowVersion,
  type WorkflowStepDraftInput,
} from "@/lib/cms-workflow";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/cms/workflow/[id] — Aktifkan atau arsipkan versi terpublikasi (multi-ACTIVE diizinkan). */
export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const parsed = await parseJsonRequest(request, workflowStatusPatchSchema);
  if (!parsed.success) return parsed.response;

  return prisma.$transaction(async tx => {
    await lockWorkflowVersions(tx);
    const existing = await tx.pipelineWorkflowVersion.findUnique({
      where: { id },
      select: { id: true, status: true, version: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Versi workflow tidak ditemukan." }, { status: 404 });
    }

    if (existing.version === null || existing.status === "DRAFT") {
      return NextResponse.json(
        {
          error:
            "Hanya versi terpublikasi yang dapat diaktifkan atau diarsipkan. Publikasikan draf terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    if (existing.status === parsed.data.status) {
      const unchanged = await tx.pipelineWorkflowVersion.findUnique({
        where: { id },
        include: cmsWorkflowVersionInclude,
      });
      if (!unchanged) {
        return NextResponse.json({ error: "Versi workflow tidak ditemukan." }, { status: 404 });
      }
      return NextResponse.json({ version: serializeWorkflowVersion(unchanged) });
    }

    if (parsed.data.status === "ARCHIVED" && existing.status === "ACTIVE" && await tx.pipelineWorkflowVersion.count({ where: { status: "ACTIVE" } }) <= 1) {
      return NextResponse.json({ error: "Minimal satu versi alur harus aktif untuk menerima pengajuan baru." }, { status: 409 });
    }

    const updated = await tx.pipelineWorkflowVersion.update({
      where: { id },
      data: { status: parsed.data.status },
      include: cmsWorkflowVersionInclude,
    });

    return NextResponse.json({
      version: serializeWorkflowVersion(updated),
    });
  });
}

/** PUT /api/cms/workflow/[id] — Simpan perubahan langkah pada versi berstatus `DRAFT`. */
export async function PUT(request: NextRequest, context: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const parsed = await parseJsonRequest(request, workflowDraftSaveSchema);
  if (!parsed.success) return parsed.response;

  return prisma.$transaction(async tx => {
    await lockWorkflowVersions(tx);
    const existing = await tx.pipelineWorkflowVersion.findUnique({
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

    const normalizedSteps = normalizeWorkflowStepsForSave(
      parsed.data.steps as WorkflowStepDraftInput[],
      id
    );

    await tx.pipelineStep.deleteMany({ where: { workflowVersionId: id } });
    await tx.pipelineStep.createMany({ data: normalizedSteps });

    const updated = await tx.pipelineWorkflowVersion.update({
      where: { id },
      data: {
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
      },
      include: cmsWorkflowVersionInclude,
    });

    return NextResponse.json({
      version: serializeWorkflowVersion(updated),
    });
  });
}

/** DELETE /api/cms/workflow/[id] — Hapus draf workflow yang belum memiliki pengajuan terkait. */
export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  return prisma.$transaction(async tx => {
    await lockWorkflowVersions(tx);
    const existing = await tx.pipelineWorkflowVersion.findUnique({
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

    await tx.pipelineWorkflowVersion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
