import { z } from "zod";

export const TRAIN_INQUIRY_MODE_LABELS = { MEDIA: "Media iklan", FULL_BRANDING: "Full branding" };
export const trainInquiryInputSchema = z.object({
  requestedTrainsetCount: z.number().int().min(1).max(999).optional(),
  campaignStart: z.iso.date().optional(),
  campaignEnd: z.iso.date().optional(),
  campaignNeeds: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.campaignStart) !== Boolean(value.campaignEnd)) context.addIssue({ code: "custom", path: ["campaignEnd"], message: "Isi tanggal mulai dan selesai kampanye." });
  if (value.campaignStart && value.campaignEnd && value.campaignEnd < value.campaignStart) context.addIssue({ code: "custom", path: ["campaignEnd"], message: "Tanggal selesai harus setelah tanggal mulai." });
});
export type TrainInquiryInput = z.infer<typeof trainInquiryInputSchema>;
export type PublicTrainInquiry = {
  mediaId: string | null;
  mediaCode: string;
  mediaTitle: string;
  mode: keyof typeof TRAIN_INQUIRY_MODE_LABELS;
  requestedTrainsetCount: number | null;
  campaignStart: string | null;
  campaignEnd: string | null;
  campaignNeeds: string | null;
  train: { name: string; slug: string };
  media: { imageUrl: string | null; description: string | null } | null;
};

export function trainCampaignPeriod(request: Pick<PublicTrainInquiry, "campaignStart" | "campaignEnd">) {
  const format = (value: string) => new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  return request.campaignStart && request.campaignEnd ? `${format(request.campaignStart)} – ${format(request.campaignEnd)}` : "Belum ditentukan";
}
