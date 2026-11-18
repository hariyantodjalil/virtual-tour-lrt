import { z } from "zod";

export const INQUIRY_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_INQUIRY_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isSafeInquiryMediaLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || /[\s\0]/.test(trimmed)) return false;

  if (trimmed.startsWith("/api/s3-proxy/") || trimmed.startsWith("/uploads/")) {
    return !trimmed.includes("..");
  }

  try {
    const url = new URL(trimmed);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const inquiryMediaLinkSchema = z
  .string()
  .trim()
  .min(1, "Tautan atau file dokumen wajib diisi")
  .max(2048)
  .refine(
    isSafeInquiryMediaLink,
    "Gunakan tautan HTTP/HTTPS tanpa kredensial atau path internal hasil unggahan."
  );

export const inquiryMediaSchema = z
  .object({
    stepOrder: z.number().int().min(1).max(100),
    mediaTitle: z.string().trim().min(2).max(160),
    documentNumber: z.string().trim().max(160).nullable().optional(),
    mediaLink: inquiryMediaLinkSchema,
    isVisibleToMitra: z.boolean().default(false),
  })
  .strict();

export const inquiryMediaUpdateSchema = z
  .object({
    mediaId: z.string().trim().min(1).max(128),
    mediaTitle: z.string().trim().min(2).max(160).optional(),
    documentNumber: z.string().trim().max(160).nullable().optional(),
    mediaLink: inquiryMediaLinkSchema.optional(),
    isVisibleToMitra: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.mediaTitle !== undefined ||
      value.documentNumber !== undefined ||
      value.mediaLink !== undefined ||
      value.isVisibleToMitra !== undefined,
    "Minimal satu perubahan dokumen harus diisi"
  );

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

export function sanitizeInquiryFileName(fileName: string, fallbackExt: string): string {
  const withoutDir = fileName.split(/[/\\]/).pop() ?? "";
  const dotIdx = withoutDir.lastIndexOf(".");
  const rawBase = dotIdx > 0 ? withoutDir.slice(0, dotIdx) : withoutDir;
  const cleanedBase = rawBase
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const safeBase = cleanedBase || "dokumen";
  return `${safeBase}.${fallbackExt}`;
}

export function hasValidInquiryFileSignature(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "application/pdf":
      return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case "image/jpeg":
      return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return false;
  }
}
