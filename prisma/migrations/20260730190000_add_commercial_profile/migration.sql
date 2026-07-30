CREATE TABLE "commercial_profiles" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "teamName" TEXT NOT NULL DEFAULT 'Tim Komersial LRT Jabodebek',
  "contactPersonName" TEXT,
  "whatsappNumber" TEXT NOT NULL DEFAULT '628118012012',
  "phoneNumber" TEXT,
  "email" TEXT,
  "officeAddress" TEXT,
  "defaultWhatsappMessage" TEXT NOT NULL DEFAULT 'Halo, saya tertarik ruang komersial LRT Jabodebek. Mohon info lebih lanjut.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "commercial_profiles_pkey" PRIMARY KEY ("id")
);

INSERT INTO "commercial_profiles" (
  "id",
  "teamName",
  "whatsappNumber",
  "defaultWhatsappMessage",
  "updatedAt"
) VALUES (
  'default',
  'Tim Komersial LRT Jabodebek',
  '628118012012',
  'Halo, saya tertarik ruang komersial LRT Jabodebek. Mohon info lebih lanjut.',
  CURRENT_TIMESTAMP
);

ALTER TABLE "stations"
  ALTER COLUMN "commercialContactPhone" DROP DEFAULT;

UPDATE "stations"
SET "commercialContactPhone" = NULL
WHERE REGEXP_REPLACE(COALESCE("commercialContactPhone", ''), '[^0-9]', '', 'g') = '628118012012';
