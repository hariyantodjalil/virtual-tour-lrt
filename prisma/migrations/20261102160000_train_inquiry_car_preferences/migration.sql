-- Preferensi gerbong yang dipilih calon mitra pada pengajuan iklan kereta.
CREATE TABLE "train_inquiry_cars" (
  "inquiryId" TEXT NOT NULL,
  "carSlug" TEXT NOT NULL,
  "carLabel" TEXT NOT NULL,
  CONSTRAINT "train_inquiry_cars_pkey" PRIMARY KEY ("inquiryId", "carSlug")
);
ALTER TABLE "train_inquiry_cars" ADD CONSTRAINT "train_inquiry_cars_inquiryId_fkey"
  FOREIGN KEY ("inquiryId") REFERENCES "train_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
