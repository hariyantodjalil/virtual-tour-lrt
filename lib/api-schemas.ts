import { z } from "zod";
import { sceneEntryViewSchema } from "./scene-entry-view";
import { ACTIVE_LEAD_STATUSES, SITE_VISIT_STATUS_VALUES } from "./commercial-pipeline";
import {
  SPACE_AREA_KIND_VALUES,
  STATION_DIMENSION_LIMITS,
  TRAIN_DIMENSION_LIMITS,
  validateDimensions,
  type DimensionLimits,
} from "./unit-dimensions";

const id = z.string().trim().min(1).max(128);
const shortText = z.string().trim().min(1).max(160);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const safeInteger = z.number().int().min(0).max(1_000_000);
const nonNegativeNumber = z.number().finite().min(0).max(1_000_000_000_000);
const nullableUrl = z.string().trim().max(2_048).nullable().optional();
const contactNumber = z
  .string()
  .trim()
  .min(8)
  .max(32)
  .regex(/^[+0-9()\s.-]+$/, "Format nomor kontak tidak valid");
const optionalDate = z.string().trim().max(64).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Tanggal tidak valid"
).nullable().optional();
// Batas atas per konteks (stasiun/kereta) dicek di dimensionRefinement agar pesannya sama dengan form CMS.
const dimension = z.number().finite().nullable().optional();
const dimensionFields = { lengthM: dimension, widthM: dimension, heightM: dimension };

function dimensionRefinement(limits: DimensionLimits) {
  return (value: { lengthM?: number | null; widthM?: number | null; heightM?: number | null }, ctx: z.RefinementCtx) => {
    const message = validateDimensions(value, limits);
    if (message) ctx.addIssue({ code: "custom", path: ["lengthM"], message });
  };
}

const stationFields = {
  code: z.string().trim().max(32).nullable().optional(),
  name: shortText,
  nameId: optionalText(160),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  line: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(500),
  location: optionalText(160),
  dailyPassengers: z.number().int().min(0).max(10_000_000).optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  imageUrl: nullableUrl,
  description: optionalText(5_000),
  commercialContactPhone: optionalText(32),
  order: safeInteger.optional(),
  isActive: z.boolean().optional(),
};

export const stationCreateSchema = z.object(stationFields).strict();
export const stationUpdateSchema = z.object(stationFields).partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "Minimal satu field harus diisi"
);

export const commercialProfileUpdateSchema = z
  .object({
    teamName: shortText.optional(),
    contactPersonName: optionalText(160),
    whatsappNumber: contactNumber.optional(),
    phoneNumber: contactNumber.nullable().optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    officeAddress: optionalText(500),
    defaultWhatsappMessage: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diisi");

export const spaceMutationSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: shortText,
  type: z.enum(["KIOS", "RUKO", "ATM", "VENDING", "MEDIA_IKLAN", "AREA_PROMOSI"]),
  status: z.enum(["TERSEDIA", "RESERVED", "FIT_OUT", "TERISI", "MAINTENANCE"]),
  area: nonNegativeNumber,
  monthlyRent: nonNegativeNumber,
  deposit: nonNegativeNumber,
  floor: z.string().trim().min(1).max(64),
  location: z.string().trim().min(1).max(300),
  nearestExit: optionalText(160),
  nearbyFacilities: z
    .array(z.enum(["toilet", "mushola", "escalator", "lift", "gate"]))
    .max(10)
    .default([]),
  exposure: z.number().int().min(0).max(1_000_000),
  powerSupply: optionalText(160),
  waterAccess: z.boolean(),
  airConditioning: z.boolean(),
  description: optionalText(5_000),
  panoramaUrl: nullableUrl,
  tenantId: id.nullable().optional(),
  ...dimensionFields,
  areaKind: z.enum(SPACE_AREA_KIND_VALUES).default("FIXED"),
  parentZoneId: id.nullable().optional(),
}).strict().superRefine(dimensionRefinement(STATION_DIMENSION_LIMITS));

export const trainRentalSpaceMutationSchema = z.object({
  displayNumber: z.string().trim().min(1).max(8).regex(/^\d{2}$/, "Nomor tampilan harus 2 digit, mis. 01"),
  title: shortText,
  description: optionalText(5_000),
  imageUrl: nullableUrl,
  objectPosition: z.string().trim().min(1).max(32).default("50% 50%"),
  availableTrainsets: z.array(z.string().trim().min(1).max(16)).max(40).default([]),
  availableByCar: z.record(z.string(), z.array(z.string().trim().min(1).max(16)).max(40)).optional(),
  howToOrder: optionalText(2_000),
  status: z.enum(["TERSEDIA", "TERBATAS", "PENUH"]).default("TERSEDIA"),
  monthlyRent: nonNegativeNumber.nullable().optional(),
  order: safeInteger.optional(),
  isActive: z.boolean().optional(),
  ...dimensionFields,
}).strict().superRefine(dimensionRefinement(TRAIN_DIMENSION_LIMITS));

export const userCreateSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  name: shortText,
  password: z.string().min(12).max(128),
  role: z.enum(["ADMIN", "EDITOR", "MITRA"]).default("EDITOR"),
}).strict();

export const userUpdateSchema = z.object({
  name: shortText.optional(),
  role: z.enum(["ADMIN", "EDITOR", "MITRA"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(12).max(128).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diisi");

export const tenantCreateSchema = z.object({
  stationId: id,
  brandName: shortText,
  contactName: optionalText(160),
  phone: optionalText(32),
  email: z.string().trim().email().max(254).nullable().optional(),
  notes: optionalText(5_000),
  spaceId: id.optional(),
  startDate: optionalDate,
  endDate: optionalDate,
}).strict().refine(
  ({ startDate, endDate }) => !startDate || !endDate || Date.parse(startDate) <= Date.parse(endDate),
  { message: "endDate tidak boleh sebelum startDate", path: ["endDate"] }
);

export const tenantUpdateSchema = z.object({
  brandName: shortText.optional(),
  contactName: optionalText(160),
  phone: optionalText(32),
  email: z.string().trim().email().max(254).nullable().optional(),
  notes: optionalText(5_000),
  logoUrl: nullableUrl,
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diisi");

export const occupancySchema = z.object({
  spaceId: id,
  startDate: optionalDate,
  endDate: optionalDate,
}).strict().refine(
  ({ startDate, endDate }) => !startDate || !endDate || Date.parse(startDate) <= Date.parse(endDate),
  { message: "endDate tidak boleh sebelum startDate", path: ["endDate"] }
);

export const leadUpdateSchema = z
  .object({
    id,
    operation: z
      .enum([
        "SAVE_CURRENT_STEP",
        "ADVANCE_STAGE",
        "REJECT_STAGE",
        "SAVE_INTERNAL_NOTE",
      ])
      .default("SAVE_CURRENT_STEP"),
    publicNote: optionalText(2_000),
    documentNumber: optionalText(160),
    siteVisitStatus: z.enum(SITE_VISIT_STATUS_VALUES).optional(),
    siteVisitScheduledAt: optionalDate,
    notes: optionalText(5_000),
    rejectionReason: optionalText(1_000),
    rdsOfferNo: optionalText(160),
    baNegotiationNo: optionalText(160),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.operation === "REJECT_STAGE" && !data.rejectionReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Alasan penghentian wajib diisi saat menghentikan pengajuan",
      });
    }
    if (data.operation === "ADVANCE_STAGE" && !data.publicNote?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["publicNote"],
        message: "Pesan publik tahapan wajib diisi sebelum menyelesaikan tahap ini",
      });
    }
  });

const orderItem = z.object({ sceneId: id, order: safeInteger }).strict();
export const sceneOrderSchema = z.object({ orders: z.array(orderItem).min(1).max(500) }).strict();
export const levelOrderSchema = z.object({
  orders: z.array(z.object({ levelId: id, order: safeInteger }).strict()).min(1).max(100),
}).strict();

// Preserve legacy hotspot fields while validating the new destination camera contract.
const sceneHotspotsSchema = z.array(z.unknown()).max(200).superRefine((hotspots, ctx) => {
  hotspots.forEach((hotspot, index) => {
    if (!hotspot || typeof hotspot !== "object" || !("targetView" in hotspot) || hotspot.targetView === undefined) return;
    const result = sceneEntryViewSchema.safeParse(hotspot.targetView);
    if (!result.success) {
      ctx.addIssue({ code: "custom", path: [index, "targetView"], message: "Arah kamera tujuan tidak valid." });
    }
  });
});

export const sceneCreateSchema = z.object({
  sceneId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  title: shortText,
  level: z.string().trim().min(1).max(128).optional(),
  levelId: id.optional().nullable(),
  areaId: id.optional().nullable(),
  panoramaUrl: z.string().trim().max(2_048).optional(),
  order: safeInteger.optional(),
  hotspots: sceneHotspotsSchema.optional(),
  isActive: z.boolean().optional(),
}).strict();

export const sceneUpdateSchema = z.object({
  title: shortText.optional(),
  level: z.string().trim().min(1).max(128).optional(),
  levelId: id.nullable().optional(),
  areaId: id.nullable().optional(),
  panoramaUrl: z.string().trim().max(2_048).optional(),
  originalPanoramaUrl: nullableUrl,
  thumbnailUrl: nullableUrl,
  order: safeInteger.optional(),
  hotspots: sceneHotspotsSchema.optional(),
  /** Spatial Area entities — validated ketat di route via spatialEntitiesSchema */
  spatialEntities: z.array(z.unknown()).max(100).optional(),
    spatialRevision: z.number().int().min(0).max(2_000_000_000).optional(),
    spatialOperation: z.enum(["draft", "publish"]).optional(),
  canvasData: z.unknown().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diisi");

export const levelCreateSchema = z.object({
  label: shortText,
  slug: z.string().trim().min(1).max(128).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  hint: optionalText(500),
  defaultAreaLabel: z.string().trim().min(1).max(160).optional(),
}).strict();

export const levelUpdateSchema = z.object({
  label: shortText.optional(),
  slug: z.string().trim().min(1).max(128).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  hint: optionalText(500),
  order: safeInteger.optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diisi");

export const areaCreateSchema = z.object({
  levelId: id,
  label: shortText,
  slug: z.string().trim().min(1).max(128).optional(),
}).strict();

export const areaUpdateSchema = z.object({
  levelId: id.optional(),
  label: shortText.optional(),
  slug: z.string().trim().min(1).max(128).optional(),
  order: safeInteger.optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Minimal satu field harus diisi");

export const privacyBlurBakeSchema = z.object({
  privacyBlurs: z.array(z.unknown()).min(1).max(100),
  viewerWidth: z.number().finite().positive().max(20_000).optional(),
  viewerHeight: z.number().finite().positive().max(20_000).optional(),
  hfov: z.number().finite().positive().max(180).optional(),
}).strict();

export const googleAuthSchema = z.object({
  credential: z.string().trim().min(10).max(4096),
  remember: z.boolean().optional(),
}).strict();

export const workflowStepInputSchema = z
  .object({
    stepOrder: z.number().int().min(1),
    leadStatus: z
      .enum(ACTIVE_LEAD_STATUSES as [
        (typeof ACTIVE_LEAD_STATUSES)[number],
        ...(typeof ACTIVE_LEAD_STATUSES)[number][],
      ])
      .default("CONTACTED"),
    stepType: z
      .enum(["STANDARD", "DOCUMENT_ISSUANCE", "SITE_VISIT"])
      .default("STANDARD"),
    documentNumberLabel: z.string().trim().max(120).optional().nullable(),
    slaHours: z.number().int().min(1).max(720).optional().nullable(),
    mediaRequirement: z.enum(["NONE", "OPTIONAL", "REQUIRED"]).default("OPTIONAL"),
    spaceEffect: z
      .enum(["NONE", "RESERVE_SPACE", "FIT_OUT_SPACE", "ACTIVATE_TENANT"])
      .default("NONE"),
    title: z.string().trim().min(2, "Judul tahap minimal 2 karakter").max(120),
    description: z.string().trim().max(500).optional().nullable(),
    publicMessage: z
      .string()
      .trim()
      .min(5, "Pesan panduan publik minimal 5 karakter")
      .max(2000),
  })
  .strict()
  .superRefine((step, ctx) => {
    if (step.stepType === "DOCUMENT_ISSUANCE" && !step.documentNumberLabel?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["documentNumberLabel"],
        message:
          "Label nomor surat wajib diisi untuk tipe proses Penerbitan Nomor Surat Resmi",
      });
    }
  });

export const workflowDraftSaveSchema = z
  .object({
    title: z.string().trim().min(3, "Judul versi workflow minimal 3 karakter").max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    steps: z
      .array(workflowStepInputSchema)
      .min(2, "Workflow wajib memiliki minimal 2 tahapan")
      .max(30, "Workflow maksimal memiliki 30 tahapan"),
  })
  .strict();

export const workflowCreateDraftSchema = z
  .object({
    sourceVersionId: id.optional(),
    createNew: z.boolean().optional(),
  })
  .strict()
  .default({});


