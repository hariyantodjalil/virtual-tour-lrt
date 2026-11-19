import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { workflowCreateDraftSchema } from "@/lib/api-schemas";
import {
  cmsWorkflowVersionInclude,
  getAllWorkflowVersions,
  serializeWorkflowVersion,
} from "@/lib/cms-workflow";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function buildDefaultDraftTitle(sourceVersion: number | null) {
  const stamp = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
  const base = sourceVersion ? `Draf dari v${sourceVersion}` : "Draf Alur Baru";
  return `${base} (${stamp})`;
}

/** GET /api/cms/workflow — Ambil seluruh versi workflow beserta langkah & jumlah pengajuan terikat. */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const versions = await getAllWorkflowVersions();
  return NextResponse.json(versions, { headers: NO_STORE_HEADERS });
}

/** POST /api/cms/workflow — Kloning versi sumber/ACTIVE menjadi draf baru (`DRAFT`, tanpa nomor versi hingga publish). */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let bodyInput: { sourceVersionId?: string } = {};
  const rawText = await request.text();
  if (rawText.trim()) {
    const jsonReq = new NextRequest(request.url, {
      method: "POST",
      headers: request.headers,
      body: rawText,
    });
    const parsed = await parseJsonRequest(jsonReq, workflowCreateDraftSchema);
    if (!parsed.success) return parsed.response;
    bodyInput = parsed.data;
  }

  const sourceVersion = bodyInput.sourceVersionId
    ? await prisma.pipelineWorkflowVersion.findUnique({
        where: { id: bodyInput.sourceVersionId },
        include: cmsWorkflowVersionInclude,
      })
    : await prisma.pipelineWorkflowVersion.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { version: "desc" },
        include: cmsWorkflowVersionInclude,
      });

  const fallbackSource =
    sourceVersion ??
    (await prisma.pipelineWorkflowVersion.findFirst({
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
      include: cmsWorkflowVersionInclude,
    }));

  if (!fallbackSource || fallbackSource.steps.length === 0) {
    return NextResponse.json(
      { error: "Versi workflow sumber belum tersedia untuk dikloning." },
      { status: 404 }
    );
  }

  const created = await prisma.pipelineWorkflowVersion.create({
    data: {
      version: null,
      title: buildDefaultDraftTitle(fallbackSource.version),
      description: null,
      status: "DRAFT",
      steps: {
        create: fallbackSource.steps.map((step) => ({
          stepOrder: step.stepOrder,
          leadStatus: step.leadStatus,
          stepType: step.stepType,
          documentNumberLabel: step.documentNumberLabel,
          slaHours: step.slaHours,
          mediaRequirement: step.mediaRequirement,
          requiresMedia: step.requiresMedia,
          spaceEffect: step.spaceEffect,
          title: step.title,
          description: step.description,
          publicMessage: step.publicMessage,
          showInSummary: step.showInSummary,
        })),
      },
    },
    include: cmsWorkflowVersionInclude,
  });

  return NextResponse.json(
    {
      version: serializeWorkflowVersion(created),
    },
    { status: 201 }
  );
}