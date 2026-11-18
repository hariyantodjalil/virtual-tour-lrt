import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { publicWorkflowSelect } from "@/lib/partner-inquiries";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const workflow = await prisma.pipelineWorkflowVersion.findFirst({ where: { status: "ACTIVE" }, orderBy: { version: "desc" }, select: publicWorkflowSelect });
  if (!workflow) return NextResponse.json({ error: "Alur pengajuan belum tersedia." }, { status: 404 });
  return NextResponse.json(workflow, { headers: { "Cache-Control": "private, no-store" } });
}

const schema = z.object({
  baseVersionId: z.string().min(1).max(128), title: z.string().trim().min(2).max(120),
  steps: z.array(z.object({ id: z.string().min(1).max(128), title: z.string().trim().min(2).max(120), publicMessage: z.string().trim().min(2).max(2000), showInSummary: z.boolean() }).strict()).min(1).max(50),
}).strict();

export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.success) return parsed.response;
  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.pipelineWorkflowVersion.findFirst({ where: { id: parsed.data.baseVersionId, status: "ACTIVE" }, include: { steps: { orderBy: { stepOrder: "asc" } } } });
      if (!current) return null;
      const changes = new Map(parsed.data.steps.map(step => [step.id, step]));
      if (changes.size !== current.steps.length || parsed.data.steps.length !== changes.size || current.steps.some(step => !changes.has(step.id))) throw new Error("INVALID_STEPS");
      const max = await tx.pipelineWorkflowVersion.aggregate({ _max: { version: true } });
      await tx.pipelineWorkflowVersion.update({ where: { id: current.id }, data: { status: "ARCHIVED" } });
      return tx.pipelineWorkflowVersion.create({ data: {
        version: (max._max.version ?? 0) + 1, title: parsed.data.title, description: current.description, status: "ACTIVE", publishedAt: new Date(),
        steps: { create: current.steps.map(step => {
          const change = changes.get(step.id);
          if (!change) throw new Error("INVALID_STEPS");
          return { stepOrder: step.stepOrder, leadStatus: step.leadStatus, title: change.title, description: change.publicMessage, publicMessage: change.publicMessage, requiresMedia: step.requiresMedia, showInSummary: change.showInSummary };
        }) },
      }, select: publicWorkflowSelect });
    }, { isolationLevel: "Serializable" });
    if (!result) return NextResponse.json({ error: "Versi alur sudah berubah. Muat ulang sebelum menyimpan." }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STEPS") return NextResponse.json({ error: "Tahap harus cocok dengan versi alur yang sedang diedit." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) return NextResponse.json({ error: "Versi alur sudah berubah. Muat ulang sebelum menyimpan." }, { status: 409 });
    console.error("[inquiry-workflow] update failed", error);
    return NextResponse.json({ error: "Alur pengajuan gagal disimpan." }, { status: 500 });
  }
}
