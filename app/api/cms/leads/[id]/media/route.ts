import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { INQUIRY_DOCUMENT_LABELS, inquiryDocumentLinkSchema, inquiryDocumentPatchSchema, inquiryDocumentUploadSchema, inquiryDocumentTypesForStep, isInquiryDocumentLocked, isInquiryStepDocumentLocked } from "@/lib/inquiry-media";
import { deleteInquiryDocument, generateInquiryDocumentKey, isInquiryDocumentKey, readInquiryMultipart, safeInquiryDocumentFilename, storeInquiryDocument, validateInquiryPdf } from "@/lib/inquiry-document-storage";
import { publicWorkflowSelect } from "@/lib/partner-inquiries";
import { publishInquiryEvent } from "@/lib/realtime-events";

async function notifyMediaChange(leadId: string) {
  const lead = await prisma.tenantLead.findUnique({
    where: { id: leadId },
    select: { userId: true },
  });
  await publishInquiryEvent({
    kind: "media-updated",
    leadId,
    userId: lead?.userId ?? null,
  });
}

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return fail(auth.error, auth.status);
  const { id } = await params;
  const lead = await prisma.tenantLead.findUnique({ where: { id }, select: { status: true, workflowVersionId: true, currentStepOrder: true, workflowVersion: { select: publicWorkflowSelect }, mediaAttachments: { orderBy: { createdAt: "desc" } } } });
  if (!lead) return fail("Pengajuan tidak ditemukan.", 404);
  return NextResponse.json({
    steps: lead.workflowVersion?.steps ?? [], canWrite: auth.user.role === "ADMIN", verificationLocked: isInquiryDocumentLocked(lead.status),
    media: lead.mediaAttachments.map(media => ({
      id: media.id, stepOrder: media.stepOrder, mediaTitle: media.mediaTitle,
      verificationLocked: isInquiryStepDocumentLocked(lead, media.stepOrder),
      documentType: media.documentType, documentNumber: media.documentNumber,
      mediaLink: media.storageKey ? `/api/inquiries/${encodeURIComponent(id)}/documents/${encodeURIComponent(media.id)}` : media.mediaLink,
      isStored: !!media.storageKey, fileName: media.fileName, sizeBytes: media.sizeBytes,
      isVisibleToMitra: media.isVisibleToMitra, verifiedAt: media.storageKey ? media.verifiedAt : null,
      createdAt: media.createdAt.toISOString(),
    })),
  }, { headers });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) return fail(auth.error, auth.status);
  const { id } = await params;
  const lead = await prisma.tenantLead.findUnique({ where: { id }, select: { status: true, currentStepOrder: true, workflowVersion: { select: publicWorkflowSelect } } });
  if (!lead) return fail("Pengajuan tidak ditemukan.", 404);
  const steps = lead.workflowVersion?.steps ?? [];
  if (!steps.length) return fail("Alur pengajuan tidak tersedia.", 400);

  const currentStepOrder = lead.currentStepOrder;
  function resolveStep(stepId: string | undefined, documentType: import("@/lib/inquiry-media").InquiryDocumentType) {
    const eligible = steps.filter(step => step.stepOrder <= currentStepOrder);
    if (stepId) return eligible.find(step => step.id === stepId && step.mediaRequirement !== "NONE");
    return eligible.find(step => step.stepOrder === currentStepOrder && inquiryDocumentTypesForStep(step)?.includes(documentType))
      ?? eligible.find(step => inquiryDocumentTypesForStep(step)?.includes(documentType))
      ?? eligible.find(step => step.stepOrder === currentStepOrder && step.mediaRequirement !== "NONE");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed = await parseJsonRequest(request, inquiryDocumentLinkSchema);
    if (!parsed.success) return parsed.response;
    const step = resolveStep(parsed.data.stepId, parsed.data.documentType);
    if (!step) return fail("Tahap dokumen belum tersedia untuk pengajuan ini.", 400);
    const stepOrder = step.stepOrder;
    const media = await prisma.inquiryMedia.create({
      data: {
        tenantLeadId: id,
        stepOrder,
        mediaTitle: parsed.data.mediaTitle,
        documentType: parsed.data.documentType,
        documentNumber: parsed.data.documentNumber || null,
        mediaLink: parsed.data.mediaLink,
        isVisibleToMitra: parsed.data.isVisibleToMitra,
        uploadedByAdmin: auth.user.userId,
      },
    });
    void notifyMediaChange(id);
    return NextResponse.json({ id: media.id, mediaLink: media.mediaLink, isStored: false }, { status: 201, headers });
  }

  let form: FormData;
  try { form = await readInquiryMultipart(request); }
  catch { return fail("Unggah satu PDF maksimal 10 MB menggunakan multipart/form-data.", 400); }
  const allowedFields = new Set(["file", "stepId", "documentType", "mediaTitle", "documentNumber", "isVisibleToMitra"]);
  for (const key of form.keys()) {
    if (!allowedFields.has(key) || form.getAll(key).length !== 1) return fail("Kolom unggahan tidak valid atau berulang.", 400);
  }
  const mediaTitleRaw = form.get("mediaTitle");
  const parsed = inquiryDocumentUploadSchema.safeParse({
    stepId: form.get("stepId") ?? undefined,
    documentType: form.get("documentType"),
    mediaTitle: typeof mediaTitleRaw === "string" && mediaTitleRaw.trim() ? mediaTitleRaw : undefined,
    documentNumber: form.get("documentNumber") ?? undefined,
    isVisibleToMitra: form.get("isVisibleToMitra") ?? undefined,
  });
  if (!parsed.success) return fail("Jenis, nomor, atau visibilitas dokumen tidak valid.", 400);
  const step = resolveStep(parsed.data.stepId, parsed.data.documentType);
  if (!step) return fail("Tahap dokumen belum tersedia untuk pengajuan ini.", 400);
  const stepOrder = step.stepOrder;
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Berkas PDF wajib diunggah.", 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  try { validateInquiryPdf(bytes, file.name, file.type); }
  catch (cause) { return fail(cause instanceof Error ? cause.message : "PDF tidak valid.", 400); }

  const documentId = randomUUID();
  const storageKey = generateInquiryDocumentKey(id, parsed.data.documentType);
  const fileName = safeInquiryDocumentFilename(file.name);
  try {
    await storeInquiryDocument(bytes, storageKey);
    const media = await prisma.inquiryMedia.create({ data: {
      id: documentId, tenantLeadId: id, stepOrder,
      mediaTitle: parsed.data.mediaTitle || INQUIRY_DOCUMENT_LABELS[parsed.data.documentType],
      documentType: parsed.data.documentType,
      documentNumber: parsed.data.documentNumber || null,
      mediaLink: `/api/inquiries/${encodeURIComponent(id)}/documents/${documentId}`,
      storageKey, fileName, mimeType: "application/pdf", sizeBytes: bytes.length,
      isVisibleToMitra: parsed.data.isVisibleToMitra, uploadedByAdmin: auth.user.userId,
    } });
    void notifyMediaChange(id);
    return NextResponse.json({ id: media.id, mediaLink: media.mediaLink, isStored: true }, { status: 201, headers });
  } catch (cause) {
    // Log error class/code only, never signed URLs, credentials, or document contents.
    const diagnostic = cause as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
    console.error("[inquiry/documents] upload failed", { name: diagnostic.name, code: diagnostic.code, status: diagnostic.$metadata?.httpStatusCode });
    return fail("Dokumen gagal disimpan. Coba lagi atau hubungi administrator.", 503);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = await parseJsonRequest(request, inquiryDocumentPatchSchema);
  if (!parsed.success) return parsed.response;
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM tenant_leads WHERE id = ${id} FOR UPDATE`;
      const lead = await tx.tenantLead.findUnique({ where: { id }, select: { status: true, workflowVersionId: true, currentStepOrder: true } });
      const media = await tx.inquiryMedia.findFirst({ where: { id: parsed.data.id, tenantLeadId: id } });
      if (!lead || !media) return { error: "Dokumen tidak ditemukan.", status: 404 };
      if (parsed.data.verified === true && (!media.storageKey || !isInquiryDocumentKey(media.storageKey, id, media.documentType))) {
        return { error: "Tautan eksternal tidak dapat diverifikasi. Unggah PDF sebagai dokumen baru.", status: 400 };
      }
      if (parsed.data.verified === false && media.verifiedAt && isInquiryStepDocumentLocked(lead, media.stepOrder)) {
        return { error: "Verifikasi terkunci karena pengajuan telah melewati gerbang dokumen.", status: 409 };
      }
      if (parsed.data.mediaLink !== undefined && media.storageKey) {
        return { error: "PDF tersimpan tidak diganti lewat tautan. Unggah PDF baru bila perlu.", status: 400 };
      }
      await tx.inquiryMedia.update({ where: { id: media.id }, data: {
        ...(parsed.data.mediaTitle !== undefined ? { mediaTitle: parsed.data.mediaTitle } : {}),
        ...(parsed.data.documentNumber !== undefined ? { documentNumber: parsed.data.documentNumber || null } : {}),
        ...(parsed.data.mediaLink !== undefined ? { mediaLink: parsed.data.mediaLink } : {}),
        ...(parsed.data.isVisibleToMitra !== undefined ? { isVisibleToMitra: parsed.data.isVisibleToMitra } : {}),
        ...(parsed.data.verified !== undefined ? {
          verifiedAt: parsed.data.verified ? media.verifiedAt ?? new Date() : null,
          verifiedByAdmin: parsed.data.verified ? media.verifiedByAdmin ?? auth.user.userId : null,
        } : {}),
      } });
      return { ok: true };
    }, { isolationLevel: "Serializable" });
    if ("error" in result) return fail(result.error!, result.status!);
    void notifyMediaChange(id);
    return NextResponse.json(result, { headers });
  } catch {
    return fail("Dokumen berubah atau gagal diperbarui. Muat ulang lalu coba lagi.", 409);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) return fail(auth.error, auth.status);
  const { id } = await params;
  const mediaId = request.nextUrl.searchParams.get("mediaId")?.trim();
  if (!mediaId) return fail("Parameter mediaId wajib diisi.", 400);

  const removed = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT id FROM tenant_leads WHERE id = ${id} FOR UPDATE`;
    const lead = await tx.tenantLead.findUnique({ where: { id }, select: { status: true, workflowVersionId: true, currentStepOrder: true } });
    const media = await tx.inquiryMedia.findFirst({ where: { id: mediaId, tenantLeadId: id } });
    if (!lead || !media) return { error: "Dokumen tidak ditemukan.", status: 404 };
    if (media.verifiedAt && isInquiryStepDocumentLocked(lead, media.stepOrder)) {
      return { error: "Dokumen terverifikasi terkunci dan tidak dapat dihapus.", status: 409 };
    }
    return { media: await tx.inquiryMedia.delete({ where: { id: media.id } }) };
  });
  if ("error" in removed) return fail(removed.error!, removed.status!);
  const { media } = removed;
  if (media.storageKey) {
    try {
      await deleteInquiryDocument(media.storageKey);
    } catch (cause) {
      const diagnostic = cause as { name?: string; code?: string };
      console.error("[inquiry/documents] delete storage failed", {
        name: diagnostic.name,
        code: diagnostic.code,
      });
    }
  }
  void notifyMediaChange(id);
  return NextResponse.json({ ok: true, id: media.id }, { headers });
}
