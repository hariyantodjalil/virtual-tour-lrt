ALTER TYPE "SpaceStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "SpaceStatus" ADD VALUE IF NOT EXISTS 'FIT_OUT';

ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'PKS';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'FIT_OUT_HANDOVER';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'COMMERCIAL_OPERATION';

CREATE TYPE "SiteVisitStatus" AS ENUM (
  'NONE',
  'REQUESTED',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "tenant_leads"
  ADD COLUMN "siteVisitStatus" "SiteVisitStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "siteVisitScheduledAt" TIMESTAMP(3);

ALTER TABLE "tenants"
  ADD COLUMN "userId" TEXT;

CREATE INDEX "tenants_userId_idx" ON "tenants"("userId");

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "tenant_leads"
SET "siteVisitStatus" = 'REQUESTED'
WHERE "surveyPreference" IS NOT NULL
  AND BTRIM("surveyPreference") <> '';

-- Hubungkan penyewa legacy ke akun Mitra dari pengajuan yang sudah berhasil,
-- agar unit aktif lama ikut muncul di portal Mitra.
UPDATE "tenants" AS tenant
SET "userId" = matched."userId"
FROM (
  SELECT DISTINCT ON (lead."userId", space."stationId", LOWER(lead."companyName"))
    lead."userId",
    space."stationId",
    lead."companyName"
  FROM "tenant_leads" AS lead
  JOIN "commercial_spaces" AS space ON space."id" = lead."spaceId"
  WHERE lead."userId" IS NOT NULL
    AND lead."status"::text IN ('CLOSED_WON', 'COMMERCIAL_OPERATION')
  ORDER BY
    lead."userId",
    space."stationId",
    LOWER(lead."companyName"),
    lead."updatedAt" DESC
) AS matched
WHERE tenant."userId" IS NULL
  AND tenant."stationId" = matched."stationId"
  AND LOWER(tenant."brandName") = LOWER(matched."companyName");
