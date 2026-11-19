import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cmsWorkflowVersionInclude,
  getNextPublishedVersionNumber,
  lockWorkflowVersions,
  serializeWorkflowVersion,
  validateWorkflowForPublish,
} from "@/lib/cms-workflow";

type Context = { params: Promise<{ id: string }> };

/** POST /api/cms/workflow/[id]/publish — Publikasikan `DRAFT` menjadi `ACTIVE` serta berikan nomor versi berurutan. */
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  return prisma.$transaction(async tx => {
    await lockWorkflowVersions(tx);
    const target = await tx.pipelineWorkflowVersion.findUnique({
      where: { id },
      include: cmsWorkflowVersionInclude,
    });

    if (!target) {
      return NextResponse.json({ error: "Versi workflow tidak ditemukan." }, { status: 404 });
    }

    if (target.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Hanya versi berstatus DRAFT yang dapat dipublikasikan." },
        { status: 400 }
      );
    }

    const issues = validateWorkflowForPublish(target.steps);
    if (issues.length > 0) {
      return NextResponse.json(
        {
          error: issues[0],
          issues,
        },
        { status: 400 }
      );
    }

    const nextVersion = target.version ?? (await getNextPublishedVersionNumber(tx));
    const published = await tx.pipelineWorkflowVersion.update({
      where: { id },
      data: {
        version: nextVersion,
        status: "ACTIVE",
        publishedAt: new Date(),
      },
      include: cmsWorkflowVersionInclude,
    });

    return NextResponse.json({ version: serializeWorkflowVersion(published) });
  });
}