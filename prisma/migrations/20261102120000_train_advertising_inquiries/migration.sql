CREATE TYPE "TrainInquiryMode" AS ENUM ('MEDIA', 'FULL_BRANDING');
ALTER TABLE "trains" ADD COLUMN "advertisingCapacity" INTEGER;
ALTER TABLE "trains" ADD CONSTRAINT "trains_advertisingCapacity_check" CHECK ("advertisingCapacity" IS NULL OR "advertisingCapacity" >= 0);
ALTER TABLE "train_rental_spaces" ADD COLUMN "inquiryMode" "TrainInquiryMode" NOT NULL DEFAULT 'MEDIA';
UPDATE "train_rental_spaces" SET "inquiryMode" = 'FULL_BRANDING'
WHERE "displayNumber" = '08' AND lower(trim("title")) = 'body branding';

CREATE TABLE "train_inquiries" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL UNIQUE REFERENCES "tenant_leads"("id") ON DELETE CASCADE,
  "trainId" TEXT NOT NULL REFERENCES "trains"("id") ON DELETE RESTRICT,
  "mediaId" TEXT REFERENCES "train_rental_spaces"("id") ON DELETE SET NULL,
  "mediaCode" TEXT NOT NULL,
  "mediaTitle" TEXT NOT NULL,
  "mode" "TrainInquiryMode" NOT NULL,
  "requestedTrainsetCount" INTEGER,
  "campaignStart" DATE,
  "campaignEnd" DATE,
  "campaignNeeds" TEXT,
  "allocatedTrainsets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allocationNotes" TEXT,
  CONSTRAINT "train_inquiries_request_count_check" CHECK ("requestedTrainsetCount" IS NULL OR ("mode" = 'FULL_BRANDING' AND "requestedTrainsetCount" > 0)),
  CONSTRAINT "train_inquiries_period_check" CHECK (("campaignStart" IS NULL AND "campaignEnd" IS NULL) OR ("campaignStart" IS NOT NULL AND "campaignEnd" IS NOT NULL AND "campaignEnd" >= "campaignStart"))
);
CREATE INDEX "train_inquiries_mediaId_idx" ON "train_inquiries"("mediaId");

-- Recover the media link from historical train leads without interpreting their free-text requests.
INSERT INTO "train_inquiries" ("id", "leadId", "trainId", "mediaId", "mediaCode", "mediaTitle", "mode")
SELECT 'legacy-train-' || l."id", l."id", m."trainId", m."id", m."displayNumber", m."title", m."inquiryMode"
FROM "tenant_leads" l JOIN "train_rental_spaces" m
ON split_part(l."spaceRequirement", ' | ', 1) = 'TRAIN:' || m."id"
WHERE l."spaceId" IS NULL;
