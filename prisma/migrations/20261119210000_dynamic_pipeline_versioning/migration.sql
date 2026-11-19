-- Dynamic pipeline step types + versioned workflow drafts (verified-leasing-20261117 / 6 steps)

CREATE TYPE "PipelineStepType" AS ENUM ('STANDARD', 'DOCUMENT_ISSUANCE', 'SITE_VISIT');

CREATE TYPE "StepMediaRequirement" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

CREATE TYPE "StepSpaceEffect" AS ENUM ('NONE', 'RESERVE_SPACE', 'FIT_OUT_SPACE', 'ACTIVATE_TENANT');

-- tenant_leads: posisi tahap aktif (additive)
ALTER TABLE "tenant_leads"
  ADD COLUMN IF NOT EXISTS "currentStepOrder" INTEGER NOT NULL DEFAULT 1;

-- workflow version: NULL selama DRAFT
ALTER TABLE "pipeline_workflow_versions"
  ALTER COLUMN "version" DROP NOT NULL;

UPDATE "pipeline_workflow_versions"
SET "version" = NULL
WHERE "status" = 'DRAFT';

-- pipeline_steps: tipe dinamis + hapus unique leadStatus per versi
DROP INDEX IF EXISTS "pipeline_steps_workflowVersionId_leadStatus_key";

ALTER TABLE "pipeline_steps"
  ALTER COLUMN "leadStatus" SET DEFAULT 'CONTACTED',
  ADD COLUMN "stepType" "PipelineStepType" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "documentNumberLabel" TEXT,
  ADD COLUMN "slaHours" INTEGER,
  ADD COLUMN "mediaRequirement" "StepMediaRequirement" NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "spaceEffect" "StepSpaceEffect" NOT NULL DEFAULT 'NONE';

CREATE INDEX IF NOT EXISTS "pipeline_steps_workflowVersionId_leadStatus_idx"
  ON "pipeline_steps"("workflowVersionId", "leadStatus");

-- inquiry_step_logs: nomor dokumen & site visit per log
ALTER TABLE "inquiry_step_logs"
  ADD COLUMN "documentNumber" TEXT,
  ADD COLUMN "visitStatus" "SiteVisitStatus",
  ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "inquiry_step_logs_tenantLeadId_stepOrder_idx"
  ON "inquiry_step_logs"("tenantLeadId", "stepOrder");

-- Backfill verified-leasing-20261117 (6 milestone)
UPDATE "pipeline_steps"
SET
  "stepType" = 'STANDARD',
  "documentNumberLabel" = NULL,
  "slaHours" = NULL,
  "mediaRequirement" = 'OPTIONAL',
  "requiresMedia" = false,
  "spaceEffect" = 'NONE'
WHERE "workflowVersionId" = 'verified-leasing-20261117' AND "stepOrder" = 1;

UPDATE "pipeline_steps"
SET
  "stepType" = 'STANDARD',
  "documentNumberLabel" = NULL,
  "slaHours" = NULL,
  "mediaRequirement" = 'OPTIONAL',
  "requiresMedia" = false,
  "spaceEffect" = 'NONE'
WHERE "workflowVersionId" = 'verified-leasing-20261117' AND "stepOrder" = 2;

UPDATE "pipeline_steps"
SET
  "stepType" = 'DOCUMENT_ISSUANCE',
  "documentNumberLabel" = 'LOI / Surat Negosiasi / BA Negosiasi',
  "slaHours" = NULL,
  "mediaRequirement" = 'REQUIRED',
  "requiresMedia" = true,
  "spaceEffect" = 'NONE'
WHERE "workflowVersionId" = 'verified-leasing-20261117' AND "stepOrder" = 3;

UPDATE "pipeline_steps"
SET
  "stepType" = 'DOCUMENT_ISSUANCE',
  "documentNumberLabel" = 'Dokumen persetujuan desain',
  "slaHours" = NULL,
  "mediaRequirement" = 'REQUIRED',
  "requiresMedia" = true,
  "spaceEffect" = 'NONE'
WHERE "workflowVersionId" = 'verified-leasing-20261117' AND "stepOrder" = 4;

UPDATE "pipeline_steps"
SET
  "stepType" = 'DOCUMENT_ISSUANCE',
  "documentNumberLabel" = 'Nomor Perjanjian Kerja Sama (PKS)',
  "slaHours" = NULL,
  "mediaRequirement" = 'REQUIRED',
  "requiresMedia" = true,
  "spaceEffect" = 'RESERVE_SPACE'
WHERE "workflowVersionId" = 'verified-leasing-20261117' AND "stepOrder" = 5;

UPDATE "pipeline_steps"
SET
  "stepType" = 'STANDARD',
  "documentNumberLabel" = NULL,
  "slaHours" = NULL,
  "mediaRequirement" = 'OPTIONAL',
  "requiresMedia" = false,
  "spaceEffect" = 'ACTIVATE_TENANT'
WHERE "workflowVersionId" = 'verified-leasing-20261117' AND "stepOrder" = 6;

-- Backfill currentStepOrder untuk lead existing
UPDATE "tenant_leads" l
SET "currentStepOrder" = COALESCE(
  (
    SELECT s."stepOrder"
    FROM "pipeline_steps" s
    WHERE s."workflowVersionId" = l."workflowVersionId"
      AND (
        (l."status" = 'CLOSED_WON' AND s."leadStatus" = 'COMMERCIAL_OPERATION')
        OR s."leadStatus" = l."status"
      )
    ORDER BY s."stepOrder" DESC
    LIMIT 1
  ),
  (
    SELECT log."stepOrder"
    FROM "inquiry_step_logs" log
    WHERE log."tenantLeadId" = l."id"
    ORDER BY log."createdAt" DESC
    LIMIT 1
  ),
  1
);

-- Backfill log historis (alur 6 tahap: negosiasi = step 3)
UPDATE "inquiry_step_logs" log
SET "documentNumber" = l."baNegotiationNo"
FROM "tenant_leads" l
WHERE log."tenantLeadId" = l."id"
  AND log."stepOrder" = 3
  AND l."baNegotiationNo" IS NOT NULL
  AND log."documentNumber" IS NULL;

UPDATE "inquiry_step_logs" log
SET "visitStatus" = l."siteVisitStatus",
    "scheduledAt" = l."siteVisitScheduledAt"
FROM "tenant_leads" l
WHERE log."tenantLeadId" = l."id"
  AND log."stepOrder" = 3
  AND (l."siteVisitStatus" <> 'NONE' OR l."siteVisitScheduledAt" IS NOT NULL)
  AND log."visitStatus" IS NULL;

UPDATE "inquiry_step_logs" log
SET "documentNumber" = l."rdsOfferNo"
FROM "tenant_leads" l
WHERE log."tenantLeadId" = l."id"
  AND log."stepOrder" = 3
  AND l."rdsOfferNo" IS NOT NULL
  AND log."documentNumber" IS NULL;