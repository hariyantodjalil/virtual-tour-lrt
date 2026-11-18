import { z } from "zod";

export const advertisingOptionSchema = z.object({
  id: z.string(), kind: z.enum(["APPLICANT_STATUS", "BUSINESS_CATEGORY"]),
  label: z.string(), allowsRepresentedBrand: z.boolean(), requiresDetail: z.boolean(),
  isActive: z.boolean(), order: z.number().int(), updatedAt: z.string(),
});
export const advertisingOptionsSchema = z.array(advertisingOptionSchema);
export type AdvertisingFormOption = z.infer<typeof advertisingOptionSchema>;

export const advertisingApplicantInputSchema = z.object({
  applicantStatusId: z.string().trim().min(1, "Pilih status pengaju.").max(128),
  businessCategoryId: z.string().trim().min(1, "Pilih kategori bisnis.").max(128),
  representedBrand: z.string().trim().max(160).optional(),
  businessCategoryOther: z.string().trim().max(120).optional(),
});
export type AdvertisingApplicantInput = z.infer<typeof advertisingApplicantInputSchema>;

export function validateAdvertisingApplicant(input: AdvertisingApplicantInput, options: AdvertisingFormOption[]) {
  const errors: Record<string, string> = {};
  const status = options.find(option => option.id === input.applicantStatusId && option.kind === "APPLICANT_STATUS" && option.isActive);
  const category = options.find(option => option.id === input.businessCategoryId && option.kind === "BUSINESS_CATEGORY" && option.isActive);
  if (!status) errors.applicantStatusId = "Pilih status pengaju yang tersedia.";
  if (!category) errors.businessCategoryId = "Pilih kategori bisnis yang tersedia.";
  if (category?.requiresDetail && !input.businessCategoryOther?.trim()) errors.businessCategoryOther = "Isi kategori bisnis Anda.";
  return { errors, status, category };
}
