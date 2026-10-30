import { z } from "zod";

export const inquiryMediaSchema = z.object({
  stepOrder: z.number().int().min(1).max(100),
  mediaTitle: z.string().trim().min(2).max(160),
  documentNumber: z.string().trim().max(160).nullable().optional(),
  mediaLink: z.string().url().max(2048).refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }, "Gunakan tautan HTTPS tanpa kredensial."),
  isVisibleToMitra: z.boolean().default(false),
}).strict();

export function isInquiryImage(link: string) {
  try { return /\.(png|jpe?g|webp|gif)$/i.test(new URL(link).pathname); } catch { return false; }
}
