import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const shortText = z.string().trim().min(1).max(160);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const safeInteger = z.number().int().min(0).max(1_000_000);
const nonNegativeNumber = z.number().finite().min(0).max(1_000_000_000_000);
const nullableUrl = z.string().trim().max(2_048).nullable().optional();
const optionalDate = z.string().trim().max(64).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Tanggal tidak valid"
).nullable().optional();

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

export const spaceMutationSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: shortText,
  type: z.enum(["KIOS", "RUKO", "ATM", "VENDING", "MEDIA_IKLAN", "AREA_PROMOSI"]),
  status: z.enum(["TERSEDIA", "TERISI", "MAINTENANCE"]),
  area: nonNegativeNumber,
  monthlyRent: nonNegativeNumber,
  deposit: nonNegativeNumber,
  floor: z.string().trim().min(1).max(64),
  location: z.string().trim().min(1).max(300),
  nearestExit: optionalText(160),
  exposure: z.number().int().min(0).max(1_000_000),
  powerSupply: optionalText(160),
  waterAccess: z.boolean(),
  airConditioning: z.boolean(),
  description: optionalText(5_000),
  panoramaUrl: nullableUrl,
}).strict();

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

export const leadUpdateSchema = z.object({
  id,
  status: z.enum(["NEW", "CONTACTED", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST"]).optional(),
  notes: optionalText(5_000),
  followUpAt: optionalDate,
}).strict().refine((value) => Object.keys(value).length > 1, "Minimal satu perubahan harus diisi");

const orderItem = z.object({ sceneId: id, order: safeInteger }).strict();
export const sceneOrderSchema = z.object({ orders: z.array(orderItem).min(1).max(500) }).strict();
export const levelOrderSchema = z.object({
  orders: z.array(z.object({ levelId: id, order: safeInteger }).strict()).min(1).max(100),
}).strict();

export const sceneCreateSchema = z.object({
  sceneId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  title: shortText,
  level: z.string().trim().min(1).max(128).optional(),
  levelId: id.optional().nullable(),
  areaId: id.optional().nullable(),
  panoramaUrl: z.string().trim().max(2_048).optional(),
  order: safeInteger.optional(),
  hotspots: z.array(z.unknown()).max(200).optional(),
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
  hotspots: z.array(z.unknown()).max(200).optional(),
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
