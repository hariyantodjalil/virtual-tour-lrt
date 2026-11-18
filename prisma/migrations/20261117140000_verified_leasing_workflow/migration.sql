-- Additive migration: retain legacy statuses, workflow versions, links, and audit logs.
BEGIN;
ALTER TABLE "tenant_leads"
  ADD COLUMN "leaseStartAt" DATE,
  ADD COLUMN "leaseEndAt" DATE,
  ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "paymentVerifiedByAdmin" TEXT;
ALTER TABLE "tenant_leads" ADD CONSTRAINT "tenant_leads_lease_dates_check"
  CHECK ("leaseStartAt" IS NULL OR "leaseEndAt" IS NULL OR "leaseEndAt" >= "leaseStartAt");
ALTER TABLE "inquiry_media"
  ADD COLUMN "documentType" TEXT NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedByAdmin" TEXT;
ALTER TABLE "inquiry_media" ADD CONSTRAINT "inquiry_media_verified_storage_check"
  CHECK ("verifiedAt" IS NULL OR ("storageKey" IS NOT NULL AND "verifiedByAdmin" IS NOT NULL));
CREATE INDEX "tenant_leads_leaseEndAt_idx" ON "tenant_leads"("leaseEndAt");

-- Publish six milestones for NEW inquiries only; no historical rows are reassigned.
UPDATE "pipeline_workflow_versions" SET "status" = 'ARCHIVED', "updatedAt" = CURRENT_TIMESTAMP WHERE "status" = 'ACTIVE';
INSERT INTO "pipeline_workflow_versions" ("id", "version", "title", "description", "status", "publishedAt", "updatedAt")
SELECT 'verified-leasing-20261117', COALESCE(MAX("version"), 0) + 1,
  'Alur pengajuan sewa terverifikasi', 'Enam milestone; site visit menjadi bagian negosiasi.', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "pipeline_workflow_versions";
INSERT INTO "pipeline_steps" ("id", "workflowVersionId", "stepOrder", "leadStatus", "title", "description", "publicMessage", "requiresMedia", "showInSummary") VALUES
('verified-leasing-20261117-1', 'verified-leasing-20261117', 1, 'NEW', 'Pengajuan Diterima', 'Otomatis setelah submit.', 'Pengajuan Anda telah diterima melalui Virtual Tour.', false, true),
('verified-leasing-20261117-2', 'verified-leasing-20261117', 2, 'CONTACTED', 'Dihubungi Tim Komersial', 'Konfirmasi admin.', 'Tim komersial telah menghubungi calon mitra.', false, true),
('verified-leasing-20261117-3', 'verified-leasing-20261117', 3, 'BA_SIGNED', 'Negosiasi Selesai', 'LOI, Surat Negosiasi, dan BA Negosiasi wajib terverifikasi. Site visit termasuk negosiasi.', 'Negosiasi selesai setelah LOI, Surat Negosiasi, dan BA Negosiasi lengkap dan terverifikasi. Site visit dapat diajukan selama negosiasi.', true, true),
('verified-leasing-20261117-4', 'verified-leasing-20261117', 4, 'DESIGN_REVIEW', 'Desain Disetujui', 'Dokumen persetujuan desain terverifikasi.', 'Dokumen persetujuan desain diunggah dan diverifikasi admin.', true, true),
('verified-leasing-20261117-5', 'verified-leasing-20261117', 5, 'PKS', 'PKS Ditandatangani', 'PKS final dan tanggal sewa wajib diisi.', 'PKS final terverifikasi; tanggal mulai dan berakhir masa sewa telah ditetapkan.', true, true),
('verified-leasing-20261117-6', 'verified-leasing-20261117', 6, 'COMMERCIAL_OPERATION', 'Sewa Aktif', 'Pembayaran terverifikasi dan tanggal efektif sudah berlaku.', 'Pembayaran terverifikasi dan tanggal efektif sewa sudah berlaku.', false, true);
COMMIT;
