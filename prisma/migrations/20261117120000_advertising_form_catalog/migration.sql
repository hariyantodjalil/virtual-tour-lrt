CREATE TABLE "advertising_form_options" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('APPLICANT_STATUS', 'BUSINESS_CATEGORY')),
  "label" TEXT NOT NULL,
  "allowsRepresentedBrand" BOOLEAN NOT NULL DEFAULT false,
  "requiresDetail" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "advertising_form_options_kind_label_key" ON "advertising_form_options"("kind", "label");
CREATE INDEX "advertising_form_options_kind_isActive_order_idx" ON "advertising_form_options"("kind", "isActive", "order");

ALTER TABLE "train_inquiries"
  ADD COLUMN "applicantStatusId" TEXT,
  ADD COLUMN "applicantStatusLabel" TEXT,
  ADD COLUMN "representedBrand" TEXT,
  ADD COLUMN "businessCategoryId" TEXT,
  ADD COLUMN "businessCategoryLabel" TEXT,
  ADD COLUMN "businessCategoryOther" TEXT;
ALTER TABLE "train_inquiries" ADD CONSTRAINT "train_inquiries_applicantStatusId_fkey" FOREIGN KEY ("applicantStatusId") REFERENCES "advertising_form_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "train_inquiries" ADD CONSTRAINT "train_inquiries_businessCategoryId_fkey" FOREIGN KEY ("businessCategoryId") REFERENCES "advertising_form_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "advertising_form_options" ("id", "kind", "label", "allowsRepresentedBrand", "order") VALUES
  ('adv-status-direct', 'APPLICANT_STATUS', 'Brand / Perusahaan Langsung', false, 1),
  ('adv-status-agency', 'APPLICANT_STATUS', 'Advertising Agency', true, 2);
INSERT INTO "advertising_form_options" ("id", "kind", "label", "requiresDetail", "order") VALUES
  ('adv-category-fnb', 'BUSINESS_CATEGORY', 'Makanan & Minuman (F&B)', false, 1),
  ('adv-category-finance', 'BUSINESS_CATEGORY', 'Perbankan & Keuangan', false, 2),
  ('adv-category-retail', 'BUSINESS_CATEGORY', 'Retail & E-Commerce', false, 3),
  ('adv-category-automotive', 'BUSINESS_CATEGORY', 'Otomotif', false, 4),
  ('adv-category-tech', 'BUSINESS_CATEGORY', 'Telekomunikasi & Teknologi', false, 5),
  ('adv-category-property', 'BUSINESS_CATEGORY', 'Properti & Real Estate', false, 6),
  ('adv-category-fashion', 'BUSINESS_CATEGORY', 'Fashion & Lifestyle', false, 7),
  ('adv-category-health', 'BUSINESS_CATEGORY', 'Kesehatan & Kecantikan', false, 8),
  ('adv-category-education', 'BUSINESS_CATEGORY', 'Pendidikan', false, 9),
  ('adv-category-travel', 'BUSINESS_CATEGORY', 'Transportasi & Pariwisata', false, 10),
  ('adv-category-entertainment', 'BUSINESS_CATEGORY', 'Hiburan & Media', false, 11),
  ('adv-category-services', 'BUSINESS_CATEGORY', 'Jasa & Layanan', false, 12),
  ('adv-category-other', 'BUSINESS_CATEGORY', 'Lainnya', true, 13);
