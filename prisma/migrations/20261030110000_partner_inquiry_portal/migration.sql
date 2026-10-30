BEGIN;
CREATE SEQUENCE "inquiry_code_seq";

-- AlterTable
ALTER TABLE "tenant_leads" ADD COLUMN     "inquiryCode" TEXT NOT NULL DEFAULT 'LRT-'::text || nextval('inquiry_code_seq'::regclass)::text,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "workflowVersionId" TEXT;

-- CreateTable
CREATE TABLE "pipeline_workflow_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_steps" (
    "id" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "leadStatus" "LeadStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publicMessage" TEXT NOT NULL,
    "requiresMedia" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pipeline_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_media" (
    "id" TEXT NOT NULL,
    "tenantLeadId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "mediaTitle" TEXT NOT NULL,
    "documentNumber" TEXT,
    "mediaLink" TEXT NOT NULL,
    "isVisibleToMitra" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByAdmin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_step_logs" (
    "id" TEXT NOT NULL,
    "tenantLeadId" TEXT NOT NULL,
    "pipelineStepId" TEXT,
    "stepOrder" INTEGER NOT NULL,
    "status" "LeadStatus" NOT NULL,
    "fromStatus" "LeadStatus",
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_step_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_workflow_versions_version_key" ON "pipeline_workflow_versions"("version");

-- CreateIndex
CREATE INDEX "pipeline_workflow_versions_status_idx" ON "pipeline_workflow_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_steps_workflowVersionId_stepOrder_key" ON "pipeline_steps"("workflowVersionId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_steps_workflowVersionId_leadStatus_key" ON "pipeline_steps"("workflowVersionId", "leadStatus");

-- CreateIndex
CREATE INDEX "inquiry_media_tenantLeadId_stepOrder_idx" ON "inquiry_media"("tenantLeadId", "stepOrder");

-- CreateIndex
CREATE INDEX "inquiry_step_logs_tenantLeadId_createdAt_idx" ON "inquiry_step_logs"("tenantLeadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_leads_inquiryCode_key" ON "tenant_leads"("inquiryCode");

-- AddForeignKey
ALTER TABLE "tenant_leads" ADD CONSTRAINT "tenant_leads_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "pipeline_workflow_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_steps" ADD CONSTRAINT "pipeline_steps_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "pipeline_workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_media" ADD CONSTRAINT "inquiry_media_tenantLeadId_fkey" FOREIGN KEY ("tenantLeadId") REFERENCES "tenant_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_step_logs" ADD CONSTRAINT "inquiry_step_logs_tenantLeadId_fkey" FOREIGN KEY ("tenantLeadId") REFERENCES "tenant_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_step_logs" ADD CONSTRAINT "inquiry_step_logs_pipelineStepId_fkey" FOREIGN KEY ("pipelineStepId") REFERENCES "pipeline_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "pipeline_workflow_versions" ("id","version","title","description","status","publishedAt","updatedAt") VALUES ('gitdev-leasing-v1',1,'Alur pengajuan sewa LRT Jabodebek','Tahapan proses GitDev yang berlaku.','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-NEW','gitdev-leasing-v1',1,'NEW','Inquiry Baru','Data minat sewa masuk untuk ditinjau tim komersial.','Data minat sewa masuk untuk ditinjau tim komersial.',false);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-CONTACTED','gitdev-leasing-v1',2,'CONTACTED','Sudah Dihubungi','Tim komersial menghubungi Anda untuk melengkapi informasi.','Tim komersial menghubungi Anda untuk melengkapi informasi.',false);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-RDS_OFFER','gitdev-leasing-v1',3,'RDS_OFFER','Penawaran Resmi','Tim komersial menyampaikan penawaran resmi.','Tim komersial menyampaikan penawaran resmi.',true);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-NEGOTIATING','gitdev-leasing-v1',4,'NEGOTIATING','Negosiasi','Pembahasan kebutuhan usaha dan ketentuan sewa.','Pembahasan kebutuhan usaha dan ketentuan sewa.',false);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-SITE_CHECK','gitdev-leasing-v1',5,'SITE_CHECK','Verifikasi Lokasi','Pemeriksaan lokasi dan batas area unit.','Pemeriksaan lokasi dan batas area unit.',false);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-BA_SIGNED','gitdev-leasing-v1',6,'BA_SIGNED','BA Negosiasi','Penandatanganan berita acara negosiasi.','Penandatanganan berita acara negosiasi.',true);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-DESIGN_REVIEW','gitdev-leasing-v1',7,'DESIGN_REVIEW','Review Desain','Peninjauan rancangan penataan ruang dan kebutuhan teknis.','Peninjauan rancangan penataan ruang dan kebutuhan teknis.',false);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-PKS','gitdev-leasing-v1',8,'PKS','Perjanjian Kerja Sama','Penyusunan dan penandatanganan perjanjian kerja sama.','Penyusunan dan penandatanganan perjanjian kerja sama.',true);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-BILLING','gitdev-leasing-v1',9,'BILLING','Tagihan','Proses tagihan sesuai kesepakatan.','Proses tagihan sesuai kesepakatan.',true);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-FIT_OUT_HANDOVER','gitdev-leasing-v1',10,'FIT_OUT_HANDOVER','Fit-Out & Serah Terima','Persiapan ruang, fit-out, dan serah terima.','Persiapan ruang, fit-out, dan serah terima.',true);
INSERT INTO "pipeline_steps" ("id","workflowVersionId","stepOrder","leadStatus","title","description","publicMessage","requiresMedia") VALUES ('gitdev-leasing-v1-COMMERCIAL_OPERATION','gitdev-leasing-v1',11,'COMMERCIAL_OPERATION','Operasional Komersial','Unit memasuki tahap operasional komersial.','Unit memasuki tahap operasional komersial.',false);

UPDATE "tenant_leads" SET "workflowVersionId" = 'gitdev-leasing-v1' WHERE "workflowVersionId" IS NULL;
INSERT INTO "inquiry_step_logs" ("id","tenantLeadId","pipelineStepId","stepOrder","status","action","notes","performedBy")
SELECT 'baseline-' || l."id", l."id", s."id", s."stepOrder", l."status", 'IMPORTED', 'Status tercatat saat riwayat portal mulai tersedia.', 'migration'
FROM "tenant_leads" l JOIN "pipeline_steps" s ON s."workflowVersionId" = l."workflowVersionId"
AND s."leadStatus" = CASE WHEN l."status" = 'CLOSED_WON' THEN 'COMMERCIAL_OPERATION'::"LeadStatus" WHEN l."status" = 'CLOSED_LOST' THEN 'NEW'::"LeadStatus" ELSE l."status" END;

COMMIT;
