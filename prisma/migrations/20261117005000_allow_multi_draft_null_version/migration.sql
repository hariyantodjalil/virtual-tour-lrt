-- Membolehkan multi-draf workflow (version NULL selama berstatus DRAFT; nomor versi diberikan saat publish)
ALTER TABLE "pipeline_workflow_versions"
  ALTER COLUMN "version" DROP NOT NULL;

-- Pastikan draf existing yang belum dipublikasikan tidak mengunci nomor versi sebelum publish
UPDATE "pipeline_workflow_versions"
SET "version" = NULL
WHERE "status" = 'DRAFT';
