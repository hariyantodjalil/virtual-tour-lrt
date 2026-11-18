import assert from "node:assert/strict";
import test from "node:test";
import { advertisingApplicantInputSchema, validateAdvertisingApplicant, type AdvertisingFormOption } from "./advertising-form-shared";
import { inquiryPhoneSchema } from "./inquiry-validation";

const options: AdvertisingFormOption[] = [
  { id: "direct", kind: "APPLICANT_STATUS", label: "Brand", allowsRepresentedBrand: false, requiresDetail: false, isActive: true, order: 1, updatedAt: "2026-11-17T00:00:00.000Z" },
  { id: "agency", kind: "APPLICANT_STATUS", label: "Agency", allowsRepresentedBrand: true, requiresDetail: false, isActive: true, order: 2, updatedAt: "2026-11-17T00:00:00.000Z" },
  { id: "category", kind: "BUSINESS_CATEGORY", label: "Kategori", allowsRepresentedBrand: false, requiresDetail: false, isActive: true, order: 1, updatedAt: "2026-11-17T00:00:00.000Z" },
  { id: "custom", kind: "BUSINESS_CATEGORY", label: "Lainnya", allowsRepresentedBrand: false, requiresDetail: true, isActive: true, order: 2, updatedAt: "2026-11-17T00:00:00.000Z" },
];

test("applicant status and category must be selected from the correct active catalog", () => {
  for (const input of [
    { applicantStatusId: "", businessCategoryId: "" },
    { applicantStatusId: "category", businessCategoryId: "agency" },
    { applicantStatusId: "missing", businessCategoryId: "missing" },
  ]) assert.equal(Object.keys(validateAdvertisingApplicant(input, options).errors).length, 2);
  const inactive = options.map(option => ({ ...option, isActive: false }));
  assert.equal(Object.keys(validateAdvertisingApplicant({ applicantStatusId: "direct", businessCategoryId: "category" }, inactive).errors).length, 2);
});

test("agency brand is optional and business category follows the submitted brand industry", () => {
  const input = advertisingApplicantInputSchema.parse({ applicantStatusId: "agency", businessCategoryId: "category" });
  const result = validateAdvertisingApplicant(input, options);
  assert.deepEqual(result.errors, {});
  assert.equal(result.status?.allowsRepresentedBrand, true);
  assert.equal(result.category?.label, "Kategori");
});

test("manual category is required by DB flag even if the label changes", () => {
  const renamed = options.map(option => option.id === "custom" ? { ...option, label: "Kategori tambahan" } : option);
  const input = { applicantStatusId: "direct", businessCategoryId: "custom", businessCategoryOther: "  " };
  assert.equal(validateAdvertisingApplicant(input, renamed).errors.businessCategoryOther, "Isi kategori bisnis Anda.");
  assert.deepEqual(validateAdvertisingApplicant({ ...input, businessCategoryOther: "Industri baru" }, renamed).errors, {});
});

test("WhatsApp requires a phone number with 10 to 15 digits", () => {
  for (const value of ["081234567890", "+62 812-3456-7890"]) assert.equal(inquiryPhoneSchema.safeParse(value).success, true);
  for (const value of ["..........", "0812", "1234567890123456", "+62abc8123456789", "++628123456789"]) assert.equal(inquiryPhoneSchema.safeParse(value).success, false);
});
