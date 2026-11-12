import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { inquiryMediaSchema } from "@/lib/inquiry-media";
import { publicWorkflowSelect } from "@/lib/partner-inquiries";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const lead = await prisma.tenantLead.findUnique({ where: { id }, select: { workflowVersion: { select: publicWorkflowSelect }, mediaAttachments: { orderBy: { createdAt: "desc" } } } });
  if (!lead) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ steps: lead.workflowVersion?.steps ?? [], media: lead.mediaAttachments }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, inquiryMediaSchema);
  if (!parsed.success) return parsed.response;
  const { id } = await params;
  const lead = await prisma.tenantLead.findUnique({ where: { id }, select: { workflowVersionId: true } });
  if (!lead) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  if (!lead.workflowVersionId) return NextResponse.json({ error: "Alur pengajuan tidak tersedia." }, { status: 400 });
  const step = await prisma.pipelineStep.findFirst({ where: { workflowVersionId: lead.workflowVersionId, stepOrder: parsed.data.stepOrder } });
  if (!step) return NextResponse.json({ error: "Tahap tidak sesuai alur pengajuan." }, { status: 400 });
  const media = await prisma.inquiryMedia.create({ data: { ...parsed.data, tenantLeadId: id, documentNumber: parsed.data.documentNumber || null, uploadedByAdmin: auth.user.userId } });
  return NextResponse.json(media, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = await parseJsonRequest(request, z.object({ id: z.string().min(1).max(128), isVisibleToMitra: z.boolean() }).strict());
  if (!parsed.success) return parsed.response;
  const { id } = await params;
  const result = await prisma.inquiryMedia.updateMany({ where: { id: parsed.data.id, tenantLeadId: id }, data: { isVisibleToMitra: parsed.data.isVisibleToMitra } });
  if (!result.count) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
