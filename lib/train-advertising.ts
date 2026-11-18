import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TrainInquiryInput } from "./train-advertising-shared";
import { advertisingApplicantInputSchema, advertisingOptionsSchema, validateAdvertisingApplicant } from "./advertising-form-shared";

export const publicTrainInquirySelect = {
  mediaId: true, mediaCode: true, mediaTitle: true, mode: true,
  applicantStatusLabel: true, representedBrand: true, businessCategoryLabel: true, businessCategoryOther: true,
  carPreferences: { select: { carSlug: true, carLabel: true } },
  requestedTrainsetCount: true, campaignStart: true, campaignEnd: true, campaignNeeds: true,
  train: { select: { name: true, slug: true } },
  media: { select: { imageUrl: true, description: true } },
} satisfies Prisma.TrainInquirySelect;

export const cmsTrainInquirySelect = {
  ...publicTrainInquirySelect,
  allocatedTrainsets: true, allocationNotes: true,
  train: { select: { name: true, slug: true, trainsets: { select: { code: true, isActive: true }, orderBy: { code: "asc" } } } },
} satisfies Prisma.TrainInquirySelect;

export class TrainInquiryError extends Error {}

export async function resolveTrainInquiry(mediaId: string, input: TrainInquiryInput = {}) {
  const media = await prisma.trainRentalSpace.findFirst({ where: { id: mediaId, isActive: true, train: { isActive: true }, status: { not: "PENUH" } } });
  if (!media) throw new TrainInquiryError("Media iklan tidak menerima pengajuan.");
  const applicant = advertisingApplicantInputSchema.safeParse(input);
  if (!applicant.success) throw new TrainInquiryError(applicant.error.issues[0].message);
  const rows = await prisma.advertisingFormOption.findMany({ where: { isActive: true } });
  const options = advertisingOptionsSchema.parse(rows.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() })));
  const { errors, status, category } = validateAdvertisingApplicant(applicant.data, options);
  if (!status || !category || Object.keys(errors).length) throw new TrainInquiryError(Object.values(errors)[0]);
  const categoryOther = category.requiresDetail ? applicant.data.businessCategoryOther!.trim() : null;
  if (media.inquiryMode === "FULL_BRANDING" && !input.requestedTrainsetCount) throw new TrainInquiryError("Jumlah trainset untuk full branding wajib diisi.");
  const cars = await prisma.trainTourCar.findMany({
    where: { trainId: media.trainId, isActive: true }, orderBy: { order: "asc" },
    select: { slug: true, label: true },
  });
  const requestedCars = input.carSlugs;
  const selectedCars = requestedCars ? cars.filter(car => requestedCars.includes(car.slug)) : cars;
  if (requestedCars && selectedCars.length !== requestedCars.length) throw new TrainInquiryError("Pilih gerbong aktif dari kereta yang sesuai.");
  if (media.inquiryMode === "FULL_BRANDING" && selectedCars.length !== cars.length) throw new TrainInquiryError("Full branding mencakup seluruh gerbong.");
  return {
    media,
    businessType: categoryOther ?? category.label,
    create: {
      trainId: media.trainId, mediaId: media.id, mediaCode: media.displayNumber, mediaTitle: media.title,
      mode: media.inquiryMode, requestedTrainsetCount: input.requestedTrainsetCount ?? null,
      applicantStatusId: status.id, applicantStatusLabel: status.label,
      representedBrand: status.allowsRepresentedBrand ? applicant.data.representedBrand || null : null,
      businessCategoryId: category.id, businessCategoryLabel: category.label, businessCategoryOther: categoryOther,
      campaignStart: input.campaignStart ? new Date(input.campaignStart) : null,
      campaignEnd: input.campaignEnd ? new Date(input.campaignEnd) : null,
      campaignNeeds: input.campaignNeeds || null,
      carPreferences: { create: selectedCars.map(car => ({ carSlug: car.slug, carLabel: car.label })) },
    },
    duplicateWhere: {
      OR: [ { trainInquiry: { mediaId: media.id } }, { spaceRequirement: { startsWith: `TRAIN:${media.id} | ` } } ],
    } satisfies Prisma.TenantLeadWhereInput,
  };
}
