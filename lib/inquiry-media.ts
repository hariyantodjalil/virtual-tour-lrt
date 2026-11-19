import { z } from "zod";
import { publicLeadStageIndex } from "@/lib/commercial-pipeline";

export const INQUIRY_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_INQUIRY_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const INQUIRY_DOCUMENT_TYPES = ["LOI", "NEGOTIATION_LETTER", "NEGOTIATION_MINUTES", "DESIGN_APPROVAL", "PKS_FINAL", "OTHER"] as const;
export type InquiryDocumentType = typeof INQUIRY_DOCUMENT_TYPES[number];
export const inquiryDocumentTypeSchema = z.enum(INQUIRY_DOCUMENT_TYPES);
export const INQUIRY_DOCUMENT_LABELS: Record<InquiryDocumentType, string> = {
  LOI: "Letter of Intent (LOI)",
  NEGOTIATION_LETTER: "Surat negosiasi",
  NEGOTIATION_MINUTES: "Berita acara negosiasi",
  DESIGN_APPROVAL: "Persetujuan desain",
  PKS_FINAL: "PKS final",
  OTHER: "Dokumen lainnya",
};

/**
 * Urutan tahap publik (1–6) untuk dokumen, selaras PUBLIC_LEAD_PROCESS_STEPS.
 * Dipakai saat simpan & proyeksi mitra agar tidak bergantung pada stepOrder workflow DB.
 */
export function publicStepOrderForDocumentType(
  documentType: InquiryDocumentType | string | null | undefined,
  leadStatus?: string | null
): number {
  const milestone =
    documentType === "DESIGN_APPROVAL"
      ? "DESIGN_REVIEW"
      : documentType === "PKS_FINAL"
        ? "PKS"
        : documentType === "LOI" ||
            documentType === "NEGOTIATION_LETTER" ||
            documentType === "NEGOTIATION_MINUTES"
          ? "BA_SIGNED"
          : null;
  if (milestone) return publicLeadStageIndex(milestone) + 1;
  if (leadStatus) {
    const index = publicLeadStageIndex(leadStatus);
    return index >= 0 ? index + 1 : 1;
  }
  return 1;
}

/**
 * Slot dokumen per status lead — satu paket per tahap, bukan semua tipe sekaligus.
 * Selaras alur publik: tahap 2 = 1 dokumen pendukung, 3 = LOI/surat/BA, 4 = desain, 5 = PKS.
 */
export function documentsForLeadStatus(
  status: string
): readonly InquiryDocumentType[] | undefined {
  if (status === "CONTACTED" || status === "RDS_OFFER") return ["OTHER"];
  if (["BA_SIGNED", "NEGOTIATING", "SITE_CHECK"].includes(status)) {
    return ["LOI", "NEGOTIATION_LETTER", "NEGOTIATION_MINUTES"];
  }
  if (status === "DESIGN_REVIEW") return ["DESIGN_APPROVAL"];
  if (["PKS", "BILLING", "FIT_OUT_HANDOVER"].includes(status)) return ["PKS_FINAL"];
  return undefined;
}

// Legacy HTTPS entries remain readable, but are not verified evidence.
export const inquiryMediaSchema = z.object({
  stepOrder: z.number().int().min(1).max(100),
  mediaTitle: z.string().trim().min(2).max(160),
  documentNumber: z.string().trim().max(160).nullable().optional(),
  mediaLink: z.string().url().max(2048).refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }, "Gunakan tautan HTTPS tanpa kredensial."),
  isVisibleToMitra: z.boolean().default(false),
}).strict();

const httpsDocumentLink = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Gunakan tautan HTTPS tanpa kredensial.");

export const inquiryDocumentUploadSchema = z.object({
  documentType: inquiryDocumentTypeSchema,
  mediaTitle: z.string().trim().min(2).max(160).optional(),
  documentNumber: z.string().trim().max(160).optional(),
  isVisibleToMitra: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
}).strict();

/** Tautan eksternal (Drive, dll.) — terbaca mitra, tetapi bukan bukti PDF terverifikasi. */
export const inquiryDocumentLinkSchema = z.object({
  documentType: inquiryDocumentTypeSchema,
  mediaTitle: z.string().trim().min(2).max(160),
  documentNumber: z.string().trim().max(160).nullable().optional(),
  mediaLink: httpsDocumentLink,
  isVisibleToMitra: z.boolean().default(true),
}).strict();

export const inquiryDocumentPatchSchema = z
  .object({
    id: z.string().min(1).max(128),
    mediaTitle: z.string().trim().min(2).max(160).optional(),
    documentNumber: z.string().trim().max(160).nullable().optional(),
    mediaLink: httpsDocumentLink.optional(),
    isVisibleToMitra: z.boolean().optional(),
    verified: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.isVisibleToMitra !== undefined ||
      value.verified !== undefined ||
      value.mediaTitle !== undefined ||
      value.documentNumber !== undefined ||
      value.mediaLink !== undefined,
    "Pilih perubahan dokumen."
  );

export function isInquiryDocumentLocked(status: string) {
  return ["BA_SIGNED", "DESIGN_REVIEW", "PKS", "BILLING", "FIT_OUT_HANDOVER", "COMMERCIAL_OPERATION", "CLOSED_WON"].includes(status);
}

export function isInquiryImage(link: string) {
  try {
    const pathname = new URL(link, "https://local.invalid").pathname;
    return /\.(png|jpe?g|webp|gif)$/i.test(pathname);
  } catch {
    return false;
  }
}

export function isInquiryPdf(link: string) {
  try {
    const pathname = new URL(link, "https://local.invalid").pathname;
    return /\.pdf$/i.test(pathname);
  } catch {
    return false;
  }
}
