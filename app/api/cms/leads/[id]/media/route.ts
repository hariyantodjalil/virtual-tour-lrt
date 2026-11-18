import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import { INQUIRY_DOCUMENT_LABELS, inquiryDocumentPatchSchema, inquiryDocumentUploadSchema, isInquiryDocumentLocked } from "@/lib/inquiry-media";
import { generateInquiryDocumentKey, isInquiryDocumentKey, readInquiryMultipart, safeInquiryDocumentFilename, storeInquiryDocument, validateInquiryPdf } from "@/lib/inquiry-document-storage";
import { publicWorkflowSelect } from "@/lib/partner-inquiries";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return fail(auth.error, auth.status);
  const { id } = await params;
  const lead = await prisma.tenantLead.findUnique({ where: { id }, select: { status: true, workflowVersion: { select: publicWorkflowSelect }, mediaAttachments: { orderBy: { createdAt: "desc" } } } });
  if (!lead) return fail("Pengajuan tidak ditemukan.", 404);
  return NextResponse.json({
    steps: lead.workflowVersion?.steps ?? [], canWrite: auth.user.role === "ADMIN", verificationLocked: isInquiryDocumentLocked(lead.status),
    media: lead.mediaAttachments.map(media => ({
      id: media.id, stepOrder: media.stepOrder, mediaTitle: media.mediaTitle,
      documentType: media.documentType, documentNumber: media.documentNumber,
      mediaLink: media.storageKey ? `/api/inquiries/${encodeURIComponent(id)}/documents/${encodeURIComponent(media.id)}` : media.mediaLink,
      isStored: !!media.storageKey, fileName: media.fileName, sizeBytes: media.sizeBytes,
      isVisibleToMitra: media.isVisibleToMitra, verifiedAt: media.storageKey ? media.verifiedAt : null,
    })),
  }, { headers });
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN"]);
  if ("error" in auth) return fail(auth.error, auth.status);
  const { id } = await params;
  const lead = await prisma.tenantLead.findUnique({ where: { id }, select: { status: true, workflowVersion: { select: publicWorkflowSelect } } });
  if (!lead) return fail("Pengajuan tidak ditemukan.", 404);
  const steps = lead.workflowVersion?.steps ?? [];
  if (!steps.length) return fail("Alur pengajuan tidak tersedia.", 400);

  let form: FormData;
  try { form = await readInquiryMultipart(request); }
  catch { return fail("Unggah satu PDF maksimal 10 MB menggunakan multipart/form-data.", 400); }
  const allowedFields = new Set(["file", "documentType", "documentNumber", "isVisibleToMitra"]);
  for (const key of form.keys()) {
    if (!allowedFields.has(key) || form.getAll(key).length !== 1) return fail("Kolom unggahan tidak valid atau berulang.", 400);
  }
  const parsed = inquiryDocumentUploadSchema.safeParse({
    documentType: form.get("documentType"),
    documentNumber: form.get("documentNumber") ?? undefined,
    isVisibleToMitra: form.get("isVisibleToMitra") ?? undefined,
  });
  if (!parsed.success) return fail("Jenis, nomor, atau visibilitas dokumen tidak valid.", 400);
  const milestone = parsed.data.documentType === "OTHER" ? lead.status : parsed.data.documentType === "DESIGN_APPROVAL" ? "DESIGN_REVIEW" : parsed.data.documentType === "PKS_FINAL" ? "PKS" : "BA_SIGNED";
  const step = steps.find(value => value.leadStatus === milestone) ?? steps[0];
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
      id: documentId, tenantLeadId: id, stepOrder: step.stepOrder,
      mediaTitle: INQUIRY_DOCUMENT_LABELS[parsed.data.documentType], documentType: parsed.data.documentType,
      documentNumber: parsed.data.documentNumber || null,
      mediaLink: `/api/inquiries/${encodeURIComponent(id)}/documents/${documentId}`,
      storageKey, fileName, mimeType: "application/pdf", sizeBytes: bytes.length,
      isVisibleToMitra: parsed.data.isVisibleToMitra, uploadedByAdmin: auth.user.userId,
    } });
    return NextResponse.json({ id: media.id, mediaLink: media.mediaLink }, { status: 201, headers });
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
      const lead = await tx.tenantLead.findUnique({ where: { id }, select: { status: true } });
      const media = await tx.inquiryMedia.findFirst({ where: { id: parsed.data.id, tenantLeadId: id } });
      if (!lead || !media) return { error: "Dokumen tidak ditemukan.", status: 404 };
      if (parsed.data.verified === true && (!media.storageKey || !isInquiryDocumentKey(media.storageKey, id, media.documentType))) {
        return { error: "Tautan lama tidak dapat diverifikasi. Unggah PDF sebagai dokumen baru.", status: 400 };
      }
      if (parsed.data.verified === false && media.verifiedAt && isInquiryDocumentLocked(lead.status)) {
        return { error: "Verifikasi terkunci karena pengajuan telah melewati gerbang dokumen.", status: 409 };
      }
      await tx.inquiryMedia.update({ where: { id: media.id }, data: {
        ...(parsed.data.isVisibleToMitra !== undefined ? { isVisibleToMitra: parsed.data.isVisibleToMitra } : {}),
        ...(parsed.data.verified !== undefined ? {
          verifiedAt: parsed.data.verified ? media.verifiedAt ?? new Date() : null,
          verifiedByAdmin: parsed.data.verified ? media.verifiedByAdmin ?? auth.user.userId : null,
        } : {}),
      } });
      return { ok: true };
    }, { isolationLevel: "Serializable" });
    if ("error" in result) return fail(result.error!, result.status!);
    return NextResponse.json(result, { headers });
  } catch {
    return fail("Dokumen berubah atau gagal diperbarui. Muat ulang lalu coba lagi.", 409);
  }
}
