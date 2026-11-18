import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/api-validation";
import {
  ALLOWED_INQUIRY_MIME_EXTENSIONS,
  hasValidInquiryFileSignature,
  INQUIRY_MAX_FILE_BYTES,
  inquiryMediaSchema,
  inquiryMediaUpdateSchema,
  sanitizeInquiryFileName,
} from "@/lib/inquiry-media";
import { publicWorkflowSelect } from "@/lib/partner-inquiries";
import { deleteFromS3, extractS3KeyFromUrl, uploadToS3 } from "@/lib/s3";
import { publishInquiryEvent } from "@/lib/realtime-events";

type Context = { params: Promise<{ id: string }> };

function parseMultipartBoolean(raw: FormDataEntryValue | null, fallback = false): boolean {
  if (typeof raw !== "string") return fallback;
  return raw === "true" || raw === "1" || raw === "on";
}

async function uploadInquiryFileBuffer(input: {
  leadId: string;
  stepOrder: number;
  file: File;
}): Promise<{ mediaLink: string } | { error: string; status: number }> {
  const { leadId, stepOrder, file } = input;
  const ext = ALLOWED_INQUIRY_MIME_EXTENSIONS[file.type];
  if (!ext) {
    return {
      error: "Format file tidak didukung. Unggah PDF, JPG, PNG, atau WebP.",
      status: 400,
    };
  }
  if (file.size <= 0 || file.size > INQUIRY_MAX_FILE_BYTES) {
    return {
      error: "Ukuran file maksimal 10 MB dan tidak boleh kosong.",
      status: 400,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidInquiryFileSignature(buffer, file.type)) {
    return {
      error: "Konten file tidak sesuai dengan format PDF atau gambar yang dipilih.",
      status: 400,
    };
  }

  const safeName = sanitizeInquiryFileName(file.name, ext);
  const s3Key = `inquiries/${leadId}/step-${stepOrder}/${Date.now()}-${safeName}`;
  await uploadToS3(buffer, s3Key, file.type);
  return { mediaLink: `/api/s3-proxy/${s3Key}` };
}

async function cleanupStoredInquiryFile(mediaLink: string) {
  const s3Key = extractS3KeyFromUrl(mediaLink);
  if (!s3Key || !s3Key.startsWith("inquiries/")) return;
  try {
    await deleteFromS3(s3Key);
  } catch (error) {
    console.warn("[cms/leads/media] cleanup warning:", error);
  }
}

async function loadLeadForMediaMutation(leadId: string) {
  const lead = await prisma.tenantLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      userId: true,
      status: true,
      currentStepOrder: true,
      workflowVersionId: true,
      workflowVersion: { select: publicWorkflowSelect },
    },
  });
  if (!lead) {
    return { error: NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 }) };
  }
  if (lead.status === "CLOSED_WON" || lead.status === "CLOSED_LOST") {
    return {
      error: NextResponse.json(
        { error: "Pengajuan sudah selesai atau dihentikan; dokumen terkunci permanen." },
        { status: 400 }
      ),
    };
  }
  const currentStep = lead.workflowVersion?.steps.find(
    (step) => step.stepOrder === lead.currentStepOrder
  );
  if (!currentStep) {
    return {
      error: NextResponse.json(
        { error: "Konfigurasi tahap saat ini tidak ditemukan." },
        { status: 400 }
      ),
    };
  }
  if (currentStep.mediaRequirement === "NONE") {
    return {
      error: NextResponse.json(
        { error: `Tahap ${currentStep.title} dikonfigurasi tidak menerima dokumen.` },
        { status: 400 }
      ),
    };
  }
  return { lead, currentStep };
}

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const lead = await prisma.tenantLead.findUnique({
    where: { id },
    select: {
      workflowVersion: { select: publicWorkflowSelect },
      mediaAttachments: { orderBy: [{ stepOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!lead) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });

  return NextResponse.json(
    { steps: lead.workflowVersion?.steps ?? [], media: lead.mediaAttachments },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const loaded = await loadLeadForMediaMutation(id);
  if ("error" in loaded) return loaded.error;
  const { lead } = loaded;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const rawStepOrder = Number(formData.get("stepOrder") ?? lead.currentStepOrder);
    if (!Number.isInteger(rawStepOrder) || rawStepOrder !== lead.currentStepOrder) {
      return NextResponse.json(
        {
          error: `Dokumen hanya dapat ditambahkan pada tahap yang sedang berlangsung (Tahap ${lead.currentStepOrder}).`,
        },
        { status: 403 }
      );
    }

    const mediaTitle = String(formData.get("mediaTitle") ?? "").trim();
    const rawDocNo = formData.get("documentNumber");
    const documentNumber =
      typeof rawDocNo === "string" ? rawDocNo.trim() || null : null;
    const isVisibleToMitra = parseMultipartBoolean(formData.get("isVisibleToMitra"), true);
    const file = formData.get("file");

    if (mediaTitle.length < 2 || mediaTitle.length > 160) {
      return NextResponse.json(
        { error: "Judul dokumen harus 2 sampai 160 karakter." },
        { status: 400 }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Pilih file dokumen untuk diunggah." },
        { status: 400 }
      );
    }

    const uploaded = await uploadInquiryFileBuffer({
      leadId: id,
      stepOrder: rawStepOrder,
      file,
    });
    if ("error" in uploaded) {
      return NextResponse.json({ error: uploaded.error }, { status: uploaded.status });
    }

    const media = await prisma.inquiryMedia.create({
      data: {
        tenantLeadId: id,
        stepOrder: rawStepOrder,
        mediaTitle,
        documentNumber,
        mediaLink: uploaded.mediaLink,
        isVisibleToMitra,
        uploadedByAdmin: auth.user.userId,
      },
    });
    await publishInquiryEvent({
      kind: "media-updated",
      leadId: id,
      userId: media.isVisibleToMitra ? lead.userId : null,
    });
    return NextResponse.json(media, { status: 201 });
  }

  const parsed = await parseJsonRequest(request, inquiryMediaSchema);
  if (!parsed.success) return parsed.response;

  if (parsed.data.stepOrder !== lead.currentStepOrder) {
    return NextResponse.json(
      {
        error: `Dokumen hanya dapat ditambahkan pada tahap yang sedang berlangsung (Tahap ${lead.currentStepOrder}).`,
      },
      { status: 403 }
    );
  }

  const media = await prisma.inquiryMedia.create({
    data: {
      ...parsed.data,
      tenantLeadId: id,
      documentNumber: parsed.data.documentNumber || null,
      uploadedByAdmin: auth.user.userId,
    },
  });
  await publishInquiryEvent({
    kind: "media-updated",
    leadId: id,
    userId: media.isVisibleToMitra ? lead.userId : null,
  });
  return NextResponse.json(media, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const loaded = await loadLeadForMediaMutation(id);
  if ("error" in loaded) return loaded.error;
  const { lead } = loaded;

  const contentType = request.headers.get("content-type") ?? "";
  let mediaId = "";
  let updateData: {
    mediaTitle?: string;
    documentNumber?: string | null;
    mediaLink?: string;
    isVisibleToMitra?: boolean;
  } = {};
  let replacementFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    mediaId = String(formData.get("mediaId") ?? "").trim();
    if (!mediaId) {
      return NextResponse.json({ error: "mediaId wajib diisi." }, { status: 400 });
    }
    const rawTitle = formData.get("mediaTitle");
    if (typeof rawTitle === "string") {
      const trimmed = rawTitle.trim();
      if (trimmed.length < 2 || trimmed.length > 160) {
        return NextResponse.json(
          { error: "Judul dokumen harus 2 sampai 160 karakter." },
          { status: 400 }
        );
      }
      updateData.mediaTitle = trimmed;
    }
    if (formData.has("documentNumber")) {
      updateData.documentNumber =
        String(formData.get("documentNumber") ?? "").trim() || null;
    }
    if (formData.has("isVisibleToMitra")) {
      updateData.isVisibleToMitra = parseMultipartBoolean(
        formData.get("isVisibleToMitra"),
        true
      );
    }
    const fileEntry = formData.get("file");
    if (fileEntry instanceof File && fileEntry.size > 0) {
      replacementFile = fileEntry;
    }
  } else {
    const parsed = await parseJsonRequest(request, inquiryMediaUpdateSchema);
    if (!parsed.success) return parsed.response;
    mediaId = parsed.data.mediaId;
    updateData = {
      ...(parsed.data.mediaTitle !== undefined && { mediaTitle: parsed.data.mediaTitle }),
      ...(parsed.data.documentNumber !== undefined && {
        documentNumber: parsed.data.documentNumber || null,
      }),
      ...(parsed.data.mediaLink !== undefined && { mediaLink: parsed.data.mediaLink }),
      ...(parsed.data.isVisibleToMitra !== undefined && {
        isVisibleToMitra: parsed.data.isVisibleToMitra,
      }),
    };
  }

  const existingMedia = await prisma.inquiryMedia.findFirst({
    where: { id: mediaId, tenantLeadId: id },
  });
  if (!existingMedia) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  }
  if (existingMedia.stepOrder !== lead.currentStepOrder) {
    return NextResponse.json(
      { error: "Dokumen pada tahap yang sudah selesai terkunci permanen." },
      { status: 403 }
    );
  }

  let previousLinkToDelete: string | null = null;
  if (replacementFile) {
    const uploaded = await uploadInquiryFileBuffer({
      leadId: id,
      stepOrder: existingMedia.stepOrder,
      file: replacementFile,
    });
    if ("error" in uploaded) {
      return NextResponse.json({ error: uploaded.error }, { status: uploaded.status });
    }
    previousLinkToDelete = existingMedia.mediaLink;
    updateData.mediaLink = uploaded.mediaLink;
  } else if (updateData.mediaLink && updateData.mediaLink !== existingMedia.mediaLink) {
    previousLinkToDelete = existingMedia.mediaLink;
  }

  const updated = await prisma.inquiryMedia.update({
    where: { id: existingMedia.id },
    data: updateData,
  });

  if (previousLinkToDelete) {
    await cleanupStoredInquiryFile(previousLinkToDelete);
  }

  await publishInquiryEvent({
    kind: "media-updated",
    leadId: id,
    userId: existingMedia.isVisibleToMitra || updated.isVisibleToMitra ? lead.userId : null,
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireRole(request, ["ADMIN", "EDITOR"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const loaded = await loadLeadForMediaMutation(id);
  if ("error" in loaded) return loaded.error;
  const { lead } = loaded;

  const mediaId = request.nextUrl.searchParams.get("mediaId")?.trim();
  if (!mediaId) {
    return NextResponse.json({ error: "Parameter mediaId wajib diisi." }, { status: 400 });
  }

  const existingMedia = await prisma.inquiryMedia.findFirst({
    where: { id: mediaId, tenantLeadId: id },
  });
  if (!existingMedia) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  }
  if (existingMedia.stepOrder !== lead.currentStepOrder) {
    return NextResponse.json(
      { error: "Dokumen pada tahap yang sudah selesai tidak dapat dihapus." },
      { status: 403 }
    );
  }

  await prisma.inquiryMedia.delete({ where: { id: existingMedia.id } });
  await cleanupStoredInquiryFile(existingMedia.mediaLink);

  await publishInquiryEvent({
    kind: "media-updated",
    leadId: id,
    userId: existingMedia.isVisibleToMitra ? lead.userId : null,
  });

  return NextResponse.json({ ok: true, id: existingMedia.id });
}
