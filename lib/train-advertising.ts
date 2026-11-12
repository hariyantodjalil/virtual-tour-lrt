import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TrainInquiryInput } from "./train-advertising-shared";

export const publicTrainInquirySelect = {
  mediaId: true, mediaCode: true, mediaTitle: true, mode: true,
  requestedTrainsetCount: true, campaignStart: true, campaignEnd: true, campaignNeeds: true,
  train: { select: { name: true, slug: true } },
  media: { select: { imageUrl: true, description: true } },
} satisfies Prisma.TrainInquirySelect;

export class TrainInquiryError extends Error {}

export async function resolveTrainInquiry(mediaId: string, input: TrainInquiryInput = {}) {
  const media = await prisma.trainRentalSpace.findFirst({ where: { id: mediaId, isActive: true, train: { isActive: true }, status: { not: "PENUH" } } });
  if (!media) throw new TrainInquiryError("Media iklan tidak menerima pengajuan.");
  if (media.inquiryMode === "FULL_BRANDING" && !input.requestedTrainsetCount) throw new TrainInquiryError("Jumlah trainset untuk full branding wajib diisi.");
  if (media.inquiryMode === "MEDIA" && input.requestedTrainsetCount !== undefined) throw new TrainInquiryError("Jumlah trainset hanya untuk full branding.");
  return {
    media,
    create: {
      trainId: media.trainId, mediaId: media.id, mediaCode: media.displayNumber, mediaTitle: media.title,
      mode: media.inquiryMode, requestedTrainsetCount: input.requestedTrainsetCount ?? null,
      campaignStart: input.campaignStart ? new Date(input.campaignStart) : null,
      campaignEnd: input.campaignEnd ? new Date(input.campaignEnd) : null,
      campaignNeeds: input.campaignNeeds || null,
    },
    duplicateWhere: {
      OR: [ { trainInquiry: { mediaId: media.id } }, { spaceRequirement: { startsWith: `TRAIN:${media.id} | ` } } ],
    } satisfies Prisma.TenantLeadWhereInput,
  };
}
