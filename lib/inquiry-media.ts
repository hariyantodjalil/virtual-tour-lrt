import { z } from "zod";

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

// Legacy HTTPS entries remain readable, but are not verified evidence.
export const inquiryMediaSchema = z.object({
  stepOrder: z.number().int().min(1).max(100),
  mediaTitle: z.string().trim().min(2).max(160),
  documentNumber: z.string().trim().max(160).nullable().optional(),
  mediaLink: z.string().url().max(2048).refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }, "Gunakan tautan HTTPS tanpa kredensial."),
  isVisibleToMitra: z.boolean().default(false),
}).strict();

export const inquiryDocumentUploadSchema = z.object({
  documentType: inquiryDocumentTypeSchema,
  documentNumber: z.string().trim().max(160).optional(),
  isVisibleToMitra: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
}).strict();

export const inquiryDocumentPatchSchema = z.object({
  id: z.string().min(1).max(128),
  isVisibleToMitra: z.boolean().optional(),
  verified: z.boolean().optional(),
}).strict().refine(value => value.isVisibleToMitra !== undefined || value.verified !== undefined, "Pilih perubahan dokumen.");

export function isInquiryDocumentLocked(status: string) {
  return ["BA_SIGNED", "DESIGN_REVIEW", "PKS", "BILLING", "FIT_OUT_HANDOVER", "COMMERCIAL_OPERATION", "CLOSED_WON"].includes(status);
}

export function isInquiryImage(link: string) {
  try { return /\.(png|jpe?g|webp|gif)$/i.test(new URL(link).pathname); } catch { return false; }
}
